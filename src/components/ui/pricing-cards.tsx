import * as React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card } from "@/components/ui/card";
import { Check, X, Plus, ChevronDown, Gauge, Building2 } from "lucide-react";
import { useTranslation } from "@/lib/locale";

type BillingCycle = 'monthly' | 'yearly';

export interface PricingFeature {
  name: string;
  isIncluded: boolean;
}

export interface PricingTierCard {
  id: string;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  periodMonthly: string;
  periodYearly: string;
  /** Real, enforced cap on distinct tracked brands (enforce_analysis_limit() DB trigger) — not a display-only number. */
  maxBrands: number;
  isPopular: boolean;
  /** Plan the user is already subscribed to — renders the CTA as inert instead of clickable. */
  isCurrent?: boolean;
  buttonLabel: string;
  features: PricingFeature[];
}

interface PricingCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  plans: PricingTierCard[];
  billingCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  onPlanSelect: (planId: string, cycle: BillingCycle) => void;
  loadingPlan?: string | null;
  /** Show the built-in monthly/yearly toggle above the cards. Off when the host
   *  page renders its own billing toggle (e.g. the pricing control bar). */
  showBillingToggle?: boolean;
}

/* Features listed on a card before the rest is deferred to the comparison
   table. Five keeps every column a similar, scannable height — Agency
   otherwise ran to eight bullets while Starter had three. */
const MAX_VISIBLE_FEATURES = 5;

export const PricingCards: React.FC<PricingCardsProps> = ({
  plans,
  billingCycle,
  onCycleChange,
  onPlanSelect,
  loadingPlan,
  showBillingToggle = true,
  className,
  ...props
}) => {
  const { t } = useTranslation();
  const [showComparison, setShowComparison] = React.useState(false);
  const allFeatures = Array.from(new Set(plans.flatMap(p => p.features.map(f => f.name))));

  return (
    <div className={cn("w-full", className)} {...props}>
      {/* Billing toggle — extra top padding so the savings badge doesn't clip */}
      {showBillingToggle && (
      <div className="flex justify-center pt-6 pb-10">
        <div className="relative">
          <ToggleGroup
            type="single"
            value={billingCycle}
            onValueChange={(value) => {
              if (value === 'monthly' || value === 'yearly') onCycleChange(value);
            }}
            aria-label="Select billing cycle"
            className="border rounded-lg p-1 bg-muted/50"
          >
            <ToggleGroupItem
              value="monthly"
              aria-label="Monthly billing"
              className="px-6 py-1.5 text-sm font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:border data-[state=on]:ring-1 data-[state=on]:ring-ring/20 rounded-md transition-colors"
            >
              {t('billing_cycle_monthly')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="yearly"
              aria-label="Annual billing"
              className="px-6 py-1.5 text-sm font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:border data-[state=on]:ring-1 data-[state=on]:ring-ring/20 rounded-md transition-colors"
            >
              {t('billing_cycle_yearly')}
            </ToggleGroupItem>
          </ToggleGroup>
          {/* Centered over the whole toggle so it overlaps both the monthly
              and yearly buttons, instead of floating clear above just the
              yearly one. */}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
            {t('billing_savings')}
          </span>
        </div>
      </div>
      )}

      {/* Cards grid — align-stretch so all cards same height */}
      <div className={cn(
        "grid gap-5 items-stretch",
        plans.length <= 3
          ? "md:grid-cols-3"
          : plans.length === 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      )}>
        {plans.map((plan, index) => {
          const currentPrice = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
          const currentPeriod = billingCycle === 'monthly' ? plan.periodMonthly : plan.periodYearly;
          const isLoading = loadingPlan === plan.id;
          const prevName = index > 0 ? plans[index - 1].name : null;
          // Only what this tier *adds*. The card already promises "Everything
          // in <previous plan>" below, so re-listing inherited features made
          // every card longer while saying the same thing twice — Solo, for
          // one, repeated the LLM sources and sentiment trend it inherits
          // from Starter.
          const inheritedNames = new Set(
            plans.slice(0, index).flatMap((p) => p.features.filter((f) => f.isIncluded).map((f) => f.name))
          );
          // features[0] is, by convention in src/lib/plans.ts, always the
          // plan's real usage quota (analyses/month, or "Unlimited") — shown
          // as its own callout below instead of buried as just another
          // checklist bullet, so it stays excluded here to avoid repeating it.
          const quota = plan.features[0]?.name;
          const newInTier = plan.features
            .filter((f) => f.isIncluded && !inheritedNames.has(f.name))
            .filter((f) => f.name !== quota);
          // Cards still have to stay a scannable height, so anything past the
          // cap is left to the full comparison table below rather than
          // stretching the column.
          const included = newInTier.slice(0, MAX_VISIBLE_FEATURES);
          const hiddenCount = newInTier.length - included.length;

          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-lg",
                plan.isPopular ? "shadow-lg" : "shadow-sm"
              )}
            >
              {/* Top: plan name, price, CTA */}
              <div className="p-6 pb-5">
                <div className="flex items-center justify-between gap-2 mb-4 min-h-[1.5rem]">
                  <span className="text-sm font-medium text-muted-foreground">{plan.name}</span>
                  {plan.isPopular && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm">
                      {t('popular')}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-bold text-foreground tracking-tight leading-none">
                    {currentPrice}
                  </span>
                  {currentPeriod && (
                    <span className="text-sm font-medium text-primary/70">{currentPeriod}</span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed min-h-[2.5rem]">
                  {plan.description}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quota && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
                      <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {quota}
                    </p>
                  )}
                  {plan.maxBrands > 0 && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {plan.maxBrands === 1 ? 'Track 1 brand' : `Track up to ${plan.maxBrands} brands`}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => onPlanSelect(plan.id, billingCycle)}
                  disabled={isLoading || plan.isCurrent}
                  variant={plan.isCurrent ? 'secondary' : plan.isPopular ? 'default' : 'outline'}
                  className={cn("w-full mt-4 rounded-xl", !plan.isPopular && !plan.isCurrent && "text-primary hover:text-primary")}
                  size="lg"
                >
                  {isLoading ? 'Loading…' : (
                    <span className="inline-flex items-center gap-1.5">
                      {plan.isCurrent && <Check className="h-4 w-4" aria-hidden="true" />}
                      {plan.buttonLabel}
                    </span>
                  )}
                </Button>
              </div>

              {/* Bottom: included features + inheritance note */}
              <div className="flex-1 border-t border-border bg-muted/30 p-6 pt-5">
                <ul className="space-y-3">
                  {included.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-foreground/70" aria-hidden="true" />
                      <span className="text-sm leading-snug text-foreground">{feature.name}</span>
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowComparison(true)}
                    className="mt-3 text-sm text-primary hover:underline text-left"
                  >
                    +{hiddenCount} more
                  </button>
                )}
                {prevName && (
                  <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Everything in {prevName}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Comparison table — desktop only, collapsed by default to keep the page short */}
      {allFeatures.length > 0 && (
        <div className="mt-10 hidden md:block">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowComparison(v => !v)}
              aria-expanded={showComparison}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(var(--glass-border))] bg-card/60 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {showComparison ? 'Hide full comparison' : 'Compare all features'}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showComparison && "rotate-180")} />
            </button>
          </div>

          {showComparison && (
            <div className="mt-6 border rounded-lg overflow-x-auto shadow-sm">
              <table className="min-w-full divide-y divide-border/80">
                <thead>
                  <tr className="bg-muted/30">
                    <th scope="col" className="px-5 py-3 text-left text-sm font-semibold text-foreground/80 min-w-[180px]">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={`th-${plan.id}`}
                        scope="col"
                        className={cn(
                          "px-5 py-3 text-center text-sm font-semibold text-foreground/80 whitespace-nowrap",
                          plan.isPopular && "bg-primary/10"
                        )}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80 bg-background/90">
                  {allFeatures.map((featureName, index) => (
                    <tr
                      key={featureName}
                      className={cn(
                        "transition-colors hover:bg-accent/20",
                        index % 2 === 0 ? "bg-background" : "bg-muted/10"
                      )}
                    >
                      <td className="px-5 py-2 text-left text-sm font-medium text-foreground/90">
                        {featureName}
                      </td>
                      {plans.map((plan) => {
                        const feature = plan.features.find(f => f.name === featureName);
                        const isIncluded = feature?.isIncluded ?? false;
                        const Icon = isIncluded ? Check : X;
                        return (
                          <td
                            key={`${plan.id}-${featureName}`}
                            className={cn("px-5 py-2 text-center", plan.isPopular && "bg-primary/5")}
                          >
                            <Icon
                              className={cn("h-4 w-4 mx-auto", isIncluded ? "text-primary" : "text-muted-foreground/50")}
                              aria-hidden="true"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
