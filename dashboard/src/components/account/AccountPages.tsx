import { useState } from 'react';
import { FileText, Link2, User, Users } from 'lucide-react';
import type {
  AccountDetailsWorkspace,
  AccountIntegrationsWorkspace,
  AccountReportWorkspace,
  AccountSubscriptionsWorkspace,
  AiOpsWorkspace,
  TeamMember,
  UserProfile
} from '../../types';

interface ReportsPageProps {
  reports: AccountReportWorkspace;
}

export function ReportsPage({ reports }: ReportsPageProps) {
  const [showWizard, setShowWizard] = useState<boolean>(false);

  const renderList = (items: typeof reports.onDemand, emptyLabel: string) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/60">{emptyLabel}</p>
      ) : (
        items.map((report) => (
          <div key={report.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
              <span>Owner {report.owner}</span>
              <span>Created {report.createdAt}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{report.name}</p>
            <p className="text-xs text-white/60">Last run {report.lastRun ?? 'n/a'}{report.schedule ? ` • ${report.schedule}` : ''}</p>
          </div>
        ))
      )}
    </div>
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Reports</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Generate on-demand insights or schedule recurring deliveries.</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent"
        >
          <FileText className="h-4 w-4" /> Create new
        </button>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">On-demand</h3>
          {renderList(reports.onDemand, 'No on-demand reports.')}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Scheduled</h3>
          {renderList(reports.scheduled, 'No scheduled reports.')}
        </div>
      </div>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-6 text-sm text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Report wizard</h3>
                <p className="text-xs text-white/60">Select data sources and recipients.</p>
              </div>
              <button onClick={() => setShowWizard(false)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-white/70">This mock wizard showcases the modal flow used on dashboard.capenetworks.com.</p>
          </div>
        </div>
      )}
    </section>
  );
}

interface AiOpsPageProps {
  aiops: AiOpsWorkspace;
}

export function AiOpsPage({ aiops }: AiOpsPageProps) {
  const [enabled, setEnabled] = useState<boolean>(aiops.enabled);

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">AIOps</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">{aiops.description}</p>
        </div>
        <button
          onClick={() => setEnabled((value) => !value)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest ${
            enabled ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-accent/40 bg-accent/10 text-accent'
          }`}
        >
          {enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
        <p>
          Machine learning consolidates synthetic tests and sensor metrics into a single incident narrative. Alerts automatically include suggested actions and correlated events from your SaaS landscape.
        </p>
        <a href={aiops.learnMoreUrl} className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
          Learn more
        </a>
      </div>
    </section>
  );
}

interface SubscriptionsPageProps {
  subscriptions: AccountSubscriptionsWorkspace;
}

export function SubscriptionsPage({ subscriptions }: SubscriptionsPageProps) {
  const [activeTab, setActiveTab] = useState<'sensors' | 'agents'>('sensors');
  const tabData = activeTab === 'sensors' ? subscriptions.sensors : subscriptions.agents;

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Subscriptions</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Manage UXI sensor and agent licenses.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('sensors')}
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
              activeTab === 'sensors' ? 'bg-accent/20 text-accent' : 'border border-white/10 text-white/60'
            }`}
          >
            Sensors
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
              activeTab === 'agents' ? 'bg-accent/20 text-accent' : 'border border-white/10 text-white/60'
            }`}
          >
            Agents
          </button>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <h3 className="text-lg font-semibold text-white">{tabData.summary.headline}</h3>
        <p className="text-xs text-white/60">{tabData.summary.body}</p>
        <button className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent">
          {tabData.summary.ctaLabel}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left text-sm text-white/80">
          <thead className="bg-white/10 text-xs uppercase tracking-widest text-white/60">
            <tr>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Subscriptions</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {tabData.entries.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="px-4 py-3">{entry.service}</td>
                <td className="px-4 py-3">{entry.key}</td>
                <td className="px-4 py-3">{entry.subscriptions}</td>
                <td className="px-4 py-3">{entry.startDate}</td>
                <td className="px-4 py-3">{entry.endDate}</td>
                <td className="px-4 py-3">{entry.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface IntegrationsPageProps {
  integrations: AccountIntegrationsWorkspace;
}

export function IntegrationsPage({ integrations }: IntegrationsPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Integrations</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Connect webhooks and data push destinations, or link Aruba Central.</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Webhooks</h3>
          {integrations.webhooks.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">None configured.</p>
          ) : (
            integrations.webhooks.map((hook) => (
              <div key={hook.id} className="mt-3 rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                <p className="text-base font-semibold text-white">{hook.name}</p>
                <p className="text-xs text-white/60">{hook.target}</p>
                <p className="text-xs text-white/50">Last updated {hook.lastUpdated}</p>
              </div>
            ))
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Data push destinations</h3>
          {integrations.dataPush.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">None configured.</p>
          ) : (
            integrations.dataPush.map((entry) => (
              <div key={entry.id} className="mt-3 rounded-2xl border border-white/10 bg-surface/60 p-4 text-sm text-white/80">
                <p className="text-base font-semibold text-white">{entry.name}</p>
                <p className="text-xs text-white/60">{entry.target}</p>
                <p className="text-xs text-white/50">Last updated {entry.lastUpdated}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-dashed border-accent/40 bg-accent/10 p-5 text-sm text-accent">
        <p className="text-base font-semibold">Link Aruba Networking Central</p>
        <p className="text-xs uppercase tracking-widest">Synchronise UXI data with HPE GreenLake ecosystem.</p>
        <button className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest">
          <Link2 className="h-4 w-4" /> Link central account
        </button>
      </div>
    </section>
  );
}

interface ProfilePageProps {
  profile: UserProfile;
}

export function ProfilePage({ profile }: ProfilePageProps) {
  const [showEdit, setShowEdit] = useState<boolean>(false);

  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">My profile</h2>
        </div>
        <button onClick={() => setShowEdit(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 hover:border-accent/40 hover:text-accent">
          <User className="h-4 w-4" /> Edit
        </button>
      </header>

      <div className="mt-6 space-y-3 text-sm text-white/80">
        <p>Name: {profile.name}</p>
        <p>Email: {profile.email}</p>
        <p>Phone: {profile.phone}</p>
      </div>

      <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-rose-200">
        Log out
      </button>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1f3a]/95 p-6 text-sm text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-white">Edit profile</h3>
              <button onClick={() => setShowEdit(false)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-white/70">Profile editing is disabled in this demo.</p>
          </div>
        </div>
      )}
    </section>
  );
}

interface TeamPageProps {
  team: TeamMember[];
}

export function TeamPage({ team }: TeamPageProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Team</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Manage user access, export rosters or invite new teammates.</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white/70">
            Export list
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-widest text-accent">
            <Users className="h-4 w-4" /> Add user
          </button>
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left text-sm text-white/80">
          <thead className="bg-white/10 text-xs uppercase tracking-widest text-white/60">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Access type</th>
              <th className="px-4 py-3">Group access</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id} className="border-t border-white/5">
                <td className="px-4 py-3">{member.user}</td>
                <td className="px-4 py-3">{member.email}</td>
                <td className="px-4 py-3">{member.accessType}</td>
                <td className="px-4 py-3">{member.groupAccess}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface AccountSettingsPageProps {
  account: AccountDetailsWorkspace;
}

export function AccountSettingsPage({ account }: AccountSettingsPageProps) {
  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-surface/80 p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Account</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Account overview</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">Company details, billing contacts and global configuration options.</p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">{account.companyName}</p>
            <p className="text-xs text-white/60">Account ID {account.accountId}</p>
          </div>
          <div className="text-xs uppercase tracking-widest text-white/60">
            Activated {account.activationDate} • Sensors {account.sensorCount} • Users {account.userCount}
          </div>
        </div>
        <p className="mt-4 rounded-2xl border border-dashed border-accent/40 bg-accent/10 p-4 text-xs uppercase tracking-widest text-accent">
          {account.migrationBanner}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <h3 className="text-lg font-semibold text-white">Billing contact</h3>
        <p className="mt-2 text-xs text-white/60">{account.billingContact.name} • {account.billingContact.email}</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <h3 className="text-lg font-semibold text-white">Global configuration</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {account.globalConfig.map((config) => (
            <div key={config.id} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-white">{config.name}</p>
                <span className={`text-xs uppercase tracking-widest ${config.enabled ? 'text-emerald-300' : 'text-white/50'}`}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="mt-2 text-xs text-white/60">{config.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
        <h3 className="text-lg font-semibold text-white">Audit log</h3>
        {account.auditLog.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">No audit events captured.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-white/60">
            {account.auditLog.map((entry) => (
              <li key={entry.id}>
                {entry.createdAt} • {entry.actor} • {entry.action}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-100">
        <h3 className="text-lg font-semibold">Danger zone</h3>
        {account.dangerZone.map((action) => (
          <p key={action.id} className="mt-2 text-xs">
            <a href={action.href} className="underline">
              {action.label}
            </a>{' '}
            – {action.description}
          </p>
        ))}
      </div>
    </section>
  );
}

export type { ReportsPageProps, AiOpsPageProps, SubscriptionsPageProps, IntegrationsPageProps, ProfilePageProps, TeamPageProps, AccountSettingsPageProps };
