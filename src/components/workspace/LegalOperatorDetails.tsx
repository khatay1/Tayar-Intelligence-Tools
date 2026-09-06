import { useLocalizer } from '@/lib/ui-localization';
import { legalIdentity } from '@/lib/legal';

const fields = [
  ['Legal name', legalIdentity.name],
  ['Registration number', legalIdentity.registrationNumber],
  ['Postal address', legalIdentity.postalAddress],
  ['Country', legalIdentity.country],
  ['Legal and privacy contact', legalIdentity.contactEmail],
] as const;

export function LegalOperatorDetails() {
  const l = useLocalizer();
  const configuredFields = fields.filter(([, value]) => Boolean(value));

  if (!configuredFields.length) return null;

  return (
    <div className="space-y-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {configuredFields.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <dt className="text-xs text-gray-500">{l(label)}</dt>
            <dd className="mt-1 break-words text-sm text-gray-200">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
