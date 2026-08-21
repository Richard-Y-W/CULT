"""Execute registered baseline research against one immutable snapshot."""
from __future__ import annotations
import argparse, hashlib, importlib.metadata, json, subprocess
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats
from cult_research.econometrics import autocorrelation, engle_granger, newey_west_mean
from cult_research.factors import information_coefficient, pca_returns, quantile_forward_returns


def load_optional(root: Path, name: str) -> pd.DataFrame | None:
    path = root / f"{name}.parquet"
    return pd.read_parquet(path) if path.exists() else None


def returns_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    required = {"timestamp", "expression_id", "return"}
    if not required <= set(frame.columns):
        raise ValueError(f"expression_returns requires {sorted(required)}")
    return frame.pivot(index="timestamp", columns="expression_id", values="return").sort_index()


def run(experiment_id: str, root: Path) -> dict[str, object]:
    prevalence = load_optional(root, "expression_prevalence")
    returns = load_optional(root, "expression_returns")
    signals = load_optional(root, "expression_signals")
    events = load_optional(root, "events")
    if experiment_id == "01_data_quality" and prevalence is not None:
        return {"rows":len(prevalence),"missing_fraction":float(prevalence.isna().mean().mean()),"source_health":prevalence.get("source_health",pd.Series(dtype=str)).value_counts().to_dict()}
    if experiment_id == "02_prevalence_distribution" and prevalence is not None:
        values=prevalence["raw_prevalence"].dropna(); return {"observations":len(values),"quantiles":values.quantile([.01,.1,.5,.9,.99]).to_dict()}
    if experiment_id == "03_intraday_seasonality" and prevalence is not None:
        frame=prevalence.copy(); frame["hour_of_week"]=pd.to_datetime(frame["window_start"],utc=True).dt.dayofweek*24+pd.to_datetime(frame["window_start"],utc=True).dt.hour
        grouped=frame.groupby(["expression_id","hour_of_week"])["smoothed_prevalence"].agg(["count","median"]); return {"cells":len(grouped),"eligible_cells":int((grouped["count"]>=8).sum())}
    if returns is not None and experiment_id in {"04_return_distribution","05_autocorrelation","06_volatility_clustering","07_correlation_matrix","08_pca","09_pair_tests","10_momentum","11_reversal"}:
        matrix=returns_matrix(returns).dropna(axis=0,how="any")
        if len(matrix)<3: raise ValueError("insufficient aligned return history")
        if experiment_id=="04_return_distribution":
            values=matrix.to_numpy().ravel(); return {"mean":float(values.mean()),"standard_deviation":float(values.std(ddof=1)),"skew":float(stats.skew(values)),"excess_kurtosis":float(stats.kurtosis(values)),"hac_mean":newey_west_mean(values,min(5,len(values)-1))}
        if experiment_id=="05_autocorrelation": return {column:autocorrelation(matrix[column].to_numpy(),min(24,len(matrix)-1)).tolist() for column in matrix}
        if experiment_id=="06_volatility_clustering": return {column:{"squared":autocorrelation(matrix[column].to_numpy()**2,min(24,len(matrix)-1)).tolist(),"absolute":autocorrelation(np.abs(matrix[column].to_numpy()),min(24,len(matrix)-1)).tolist()} for column in matrix}
        if experiment_id=="07_correlation_matrix": return {"pearson":matrix.corr().to_dict(),"spearman":matrix.corr(method="spearman").to_dict()}
        if experiment_id=="08_pca":
            result=pca_returns(matrix.to_numpy(),min(10,matrix.shape[1])); return {"expressions":list(matrix.columns),"explained_variance_ratio":result["explained_variance_ratio"].tolist(),"loadings":result["loadings"].tolist()}
        if experiment_id=="09_pair_tests":
            pairs=[]
            levels=np.exp(matrix.cumsum())
            for left in range(min(10,len(matrix.columns))):
                for right in range(left+1,min(10,len(matrix.columns))):
                    result=engle_granger(levels.iloc[:,left].to_numpy(),levels.iloc[:,right].to_numpy())
                    pairs.append({"left":matrix.columns[left],"right":matrix.columns[right],**result.__dict__})
            return {"tests":pairs,"warning":"p-values require registered multiple-testing correction"}
        lookback=min(30,max(2,len(matrix)//3)); signal=matrix.rolling(lookback).sum().shift(1); forward=matrix.shift(-1)
        if experiment_id=="11_reversal": signal=-signal
        ic=[]; quantiles=[]
        for timestamp in matrix.index:
            joined=pd.concat([signal.loc[timestamp],forward.loc[timestamp]],axis=1).dropna()
            if len(joined)>=5:
                ic.append(information_coefficient(joined.iloc[:,0].to_numpy(),joined.iloc[:,1].to_numpy(),rank=True)); quantiles.append(quantile_forward_returns(joined.iloc[:,0].to_numpy(),joined.iloc[:,1].to_numpy(),min(5,len(joined))).tolist())
        return {"lookback":lookback,"rank_ic":ic,"mean_rank_ic":float(np.mean(ic)) if ic else None,"quantile_returns":quantiles,"execution":"next_bar"}
    if experiment_id == "12_event_studies": return {"registered_events":0 if events is None else len(events),"status":"INSUFFICIENT_EVENTS" if events is None or events.empty else "READY_FOR_EVENT_BASELINES"}
    if experiment_id == "13_composition_bias" and prevalence is not None:
        required={"raw_prevalence","content_adjusted_prevalence"}
        if not required<=set(prevalence.columns): return {"status":"CALIBRATION_UNAVAILABLE"}
        delta=(prevalence["content_adjusted_prevalence"]-prevalence["raw_prevalence"]).dropna(); return {"observations":len(delta),"mean_adjustment":float(delta.mean()),"absolute_adjustment":float(delta.abs().mean())}
    if experiment_id == "14_market_reference_premium" and signals is not None:
        required={"premium","forward_reference_return"}
        if not required<=set(signals.columns): return {"status":"REQUIRED_COLUMNS_UNAVAILABLE"}
        frame=signals[list(required)].dropna(); fit=stats.linregress(frame["premium"],frame["forward_reference_return"]); return {"observations":len(frame),"slope":fit.slope,"intercept":fit.intercept,"rvalue":fit.rvalue,"pvalue":fit.pvalue,"warning":"in-sample association is not causal or out-of-sample evidence"}
    return {"status":"REQUIRED_DATASET_TABLE_UNAVAILABLE"}


def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("experiment_id"); parser.add_argument("dataset"); parser.add_argument("output"); parser.add_argument("--seed",type=int,default=20260821); args=parser.parse_args()
    root=Path(args.dataset); manifest_path=root/"manifest.json"; manifest=json.loads(manifest_path.read_text(encoding="utf-8")); np.random.seed(args.seed)
    registry=json.loads(Path("research/experiments/registry.json").read_text(encoding="utf-8")); known={item["id"] for item in registry["experiments"]}
    if args.experiment_id not in known: raise SystemExit(f"unknown experiment {args.experiment_id}")
    try: git_sha=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
    except (OSError,subprocess.CalledProcessError): git_sha="UNKNOWN"
    start=pd.Timestamp(manifest["start"]); end=pd.Timestamp(manifest["end"]); duration=(end-start).total_seconds()/86400
    payload={"experiment_id":args.experiment_id,"dataset_id":manifest["dataset_id"],"dataset_manifest_sha256":hashlib.sha256(manifest_path.read_bytes()).hexdigest(),"git_sha":git_sha,"seed":args.seed,"dependency_versions":{name:importlib.metadata.version(name) for name in ("numpy","pandas","scipy","statsmodels","scikit-learn")},"coverage_days":duration,"result_status":"EXPLORATORY" if duration>=7 else "INSUFFICIENT_HISTORY","metrics":run(args.experiment_id,root),"limitations":["Single-source COIP is a non-probability sample","Correlation and predictability do not identify causality","Seven days is a minimum, not a guarantee of stable inference"]}
    Path(args.output).write_text(json.dumps(payload,indent=2,default=str,sort_keys=True)+"\n",encoding="utf-8")


if __name__=="__main__": main()
