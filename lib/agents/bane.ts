export async function executeBaneAgent(
  data: any,
  previousResponses: any[],
  supabase: any
): Promise<any> {
  const {
    baseline_metrics = {},
    experiment_hypothesis = {},
    comparison_cohorts = [],
    release_data = {},
  } = data || {};

  // Evidence validation
  const metrics = {
    impressions: !!baseline_metrics?.impressions,
    engagement: !!baseline_metrics?.engagement,
    retention: !!baseline_metrics?.retention_30sec,
    avg_view: !!baseline_metrics?.average_view_duration,
    returning: !!baseline_metrics?.returning_viewers,
    subscribers: !!baseline_metrics?.subscriber_acquisition,
  };

  const metricsGaps = Object.entries(metrics)
    .filter(([_, has]) => !has)
    .map(([key, _]) => key);

  const completeness = (6 - metricsGaps.length) / 6;
  const confidence =
    completeness >= 0.85 ? "HIGH" : completeness >= 0.65 ? "MEDIUM" : "LOW";

  const experimentValid =
    !!experiment_hypothesis?.variable &&
    !!experiment_hypothesis?.control &&
    !!experiment_hypothesis?.test &&
    !!experiment_hypothesis?.success_metric;

  const isValidSignal =
    metricsGaps.length === 0 && experimentValid;

  return {
    status: isValidSignal ? "VALID SIGNAL" : metricsGaps.length <= 2 ? "INCONCLUSIVE" : "ACTION REQUIRED",
    confidence,
    facts: [
      `Baseline metrics: ${Object.values(metrics).filter(Boolean).length}/6 present`,
      `Data completeness: ${(completeness * 100).toFixed(0)}%`,
      `Cohorts: ${comparison_cohorts.length}`,
      `Experiment: ${experimentValid ? "valid" : "incomplete"}`,
    ],
    findings: [
      ...metricsGaps.map((gap: string) => `Missing: ${gap}`),
      ...(release_data?.age_days && release_data.age_days < 3
        ? ["Early-stage data (<3 days) - patterns may reverse"]
        : []),
    ],
    decision: isValidSignal
      ? `Evidence quality HIGH. Baseline established, experiment valid.`
      : `Measurement gaps detected. ${metricsGaps.length} KPIs missing.`,
    actions: isValidSignal
      ? [
          {
            owner: "bane" as any,
            description: `Launch experiment: ${experiment_hypothesis?.variable || "measure"}`,
            deadline: new Date(Date.now() + 604800000).toISOString(),
            successMetric: "Collect 7-day measurement window",
          },
        ]
      : [],
    risks:
      metricsGaps.length > 0
        ? [`${metricsGaps.length} data gaps increase uncertainty`]
        : [],
    blockers:
      metricsGaps.length > 3
        ? ["Critical metric gaps block experiment launch"]
        : [],
    nextAgent: isValidSignal ? "thanos" : "doom",
    requiredInput: metricsGaps.length > 0 ? `Define: ${metricsGaps.join(", ")}` : undefined,
  };
}
