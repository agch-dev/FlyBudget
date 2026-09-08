import { useState } from 'react';
import { KeyRound, ExternalLink } from 'lucide-react';
import { useConfigurePlaid } from '../../hooks/usePlaid';

export function PlaidConfigForm() {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [environment, setEnvironment] = useState('sandbox');
  const configure = useConfigurePlaid();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !secret.trim()) return;
    await configure.mutateAsync({ clientId: clientId.trim(), secret: secret.trim(), environment });
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <KeyRound size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Set Up Bank Sync</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Connect your bank accounts to automatically import transactions using Plaid.
              You'll need a free Plaid developer account to get your API credentials.
            </p>
            <a
              href="https://dashboard.plaid.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              Get Plaid credentials <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Enter your Plaid Client ID"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Secret</label>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Enter your Plaid Secret"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
          <select
            value={environment}
            onChange={e => setEnvironment(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="development">Development (Real banks, limited)</option>
            <option value="production">Production</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!clientId.trim() || !secret.trim() || configure.isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {configure.isPending ? 'Saving...' : 'Save Credentials'}
        </button>
        {configure.isError && (
          <p className="text-xs text-red-500">Failed to save credentials. Please check your input and try again.</p>
        )}
      </form>
    </div>
  );
}
