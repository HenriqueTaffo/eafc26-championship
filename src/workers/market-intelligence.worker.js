import { expose } from "comlink";
import { mean, quantileSorted } from "simple-statistics";

function cleanNumbers(values = []) {
  return values
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
}

function summarizeMarket(rows = []) {
  const values = cleanNumbers(
    rows.map((item) => item.marketValue || item.market_value_eur),
  );
  const salaries = cleanNumbers(
    rows.map((item) => item.weeklySalary || item.weekly_salary_eur),
  );

  return {
    medianValue: values.length ? quantileSorted(values, 0.5) : 0,
    upperValue: values.length ? quantileSorted(values, 0.75) : 0,
    avgSalary: salaries.length ? mean(salaries) : 0,
    sampleSize: rows.length,
  };
}

expose({ summarizeMarket });
