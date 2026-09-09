import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Clock, TrendingUp } from 'lucide-react';

/** Agency plan price — keep in sync with USD.enterprise_monthly in
 *  src/lib/plans.ts. */
const AGENCY_PLAN_FROM = 199;

const Field = ({
  label, value, onChange, min, max, step, prefix, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {prefix}{value}{suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[hsl(var(--primary))] cursor-pointer"
      aria-label={label}
    />
  </div>
);

/**
 * ROI for an agency, computed entirely from numbers the agency types in
 * themselves — their audit volume, their production time, their billable
 * rate. Deliberately NOT seeded with invented customer results: Presora has
 * no attributable customer figures to quote, and inventing them would be
 * the same class of problem as the fabricated scan data this codebase has
 * already had to strip out.
 *
 * The one Presora-side input is that report *production* collapses to a
 * scan plus an export. Review, judgement and the client conversation are
 * explicitly NOT counted as saved — see the caption under the result.
 */
export const AgencyRoiCalculator = () => {
  const [auditsPerMonth, setAuditsPerMonth] = useState(8);
  const [hoursPerAudit, setHoursPerAudit] = useState(3);
  const [hourlyRate, setHourlyRate] = useState(120);

  const result = useMemo(() => {
    // Production time that collapses to a ~15s scan + export. Held back to
    // 70% on purpose: reviewing the output and tailoring the pitch is real
    // work that doesn't disappear, and an ROI number that pretends
    // otherwise is one the buyer will correctly distrust.
    const RETAINED_JUDGEMENT_SHARE = 0.3;
    const hoursSaved = auditsPerMonth * hoursPerAudit * (1 - RETAINED_JUDGEMENT_SHARE);
    const valueOfTime = hoursSaved * hourlyRate;
    const net = valueOfTime - AGENCY_PLAN_FROM;
    return {
      hoursSaved: Math.round(hoursSaved),
      valueOfTime: Math.round(valueOfTime),
      net: Math.round(net),
      positive: net > 0,
    };
  }, [auditsPerMonth, hoursPerAudit, hourlyRate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="grid md:grid-cols-2 gap-5"
    >
      {/* Inputs */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Your numbers</p>
        </div>
        <Field
          label="Audits you'd produce per month"
          value={auditsPerMonth}
          onChange={setAuditsPerMonth}
          min={1}
          max={40}
          step={1}
        />
        <Field
          label="Hours one audit takes you today"
          value={hoursPerAudit}
          onChange={setHoursPerAudit}
          min={1}
          max={16}
          step={1}
          suffix="h"
        />
        <Field
          label="Your billable rate"
          value={hourlyRate}
          onChange={setHourlyRate}
          min={40}
          max={400}
          step={10}
          prefix="$"
          suffix="/h"
        />
      </div>

      {/* Result */}
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">What that works out to</p>
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {result.hoursSaved}h
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of report production off your team's plate, per month
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-primary/15 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">That time at your rate</span>
              <span className="text-foreground font-medium tabular-nums">${result.valueOfTime.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agency plan, from</span>
              <span className="text-foreground font-medium tabular-nums">−${AGENCY_PLAN_FROM}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary/15">
              <span className="font-semibold text-foreground">Net, per month</span>
              <span className={`font-bold tabular-nums ${result.positive ? 'text-emerald-500' : 'text-amber-500'}`}>
                {result.positive ? '+' : ''}${result.net.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-5 pt-4 border-t border-primary/15">
          Every figure above comes from the sliders you just moved — we don't have
          customer averages to substitute for them. Only report <em>production</em> is
          counted as saved; 30% is deliberately held back for reviewing the output and
          tailoring the pitch, which is work that doesn't go away. The Agency plan is
          ${AGENCY_PLAN_FROM}/mo, built for agencies managing multiple client accounts.
        </p>
      </div>
    </motion.div>
  );
};
