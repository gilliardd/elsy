import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  getSystemConfig,
  setSystemConfig,
  getWhatsAppStatus,
  getWhatsAppQr,
  reconnectWhatsApp,
} from '../../services/adminApi';

interface ConfigField {
  key: string;
  label: string;
  description: string;
  isSecret: boolean;
}

const FIELDS: { section: string; items: ConfigField[] }[] = [
  {
    section: 'Asaas',
    items: [
      { key: 'asaas_api_key', label: 'API Key', description: 'Token do Asaas (sandbox ou producao)', isSecret: true },
      { key: 'asaas_environment', label: 'Ambiente', description: 'sandbox ou production', isSecret: false },
      { key: 'asaas_webhook_token', label: 'Webhook token', description: 'Token enviado pelo Asaas no header asaas-access-token', isSecret: true },
    ],
  },
  {
    section: 'Email (SMTP)',
    items: [
      { key: 'smtp_host', label: 'Host', description: '', isSecret: false },
      { key: 'smtp_port', label: 'Porta', description: '587 (TLS) / 465 (SSL)', isSecret: false },
      { key: 'smtp_user', label: 'Usuario', description: '', isSecret: false },
      { key: 'smtp_password', label: 'Senha', description: '', isSecret: true },
      { key: 'smtp_from', label: 'Remetente (From)', description: 'Endereco que aparece no email', isSecret: false },
    ],
  },
  {
    section: 'OpenAI',
    items: [
      { key: 'openai_api_key', label: 'API Key', description: 'Substitui a chave do .env quando definida', isSecret: true },
    ],
  },
];

export default function AdminSettings() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // WhatsApp
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waQr, setWaQr] = useState<string | null>(null);

  async function loadConfig() {
    const items = await getSystemConfig();
    const map: Record<string, string> = {};
    for (const i of items) {
      map[i.key] = i.value;
    }
    setConfig(map);
  }

  async function loadWhatsApp() {
    try {
      const s = await getWhatsAppStatus();
      setWaStatus(s.status);
      setWaPhone(s.connectedPhone);
      if (s.qrAvailable) {
        const qr = await getWhatsAppQr();
        setWaQr(qr);
      } else {
        setWaQr(null);
      }
    } catch {
      // ignora
    }
  }

  useEffect(() => {
    loadConfig();
    loadWhatsApp();
    const t = setInterval(loadWhatsApp, 5000);
    return () => clearInterval(t);
  }, []);

  async function save(field: ConfigField) {
    setSaving(field.key);
    try {
      await setSystemConfig(field.key, config[field.key] || '', field.isSecret, field.description);
      setSavedKey(field.key);
      setTimeout(() => setSavedKey(null), 1500);
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminLayout title="Configuracoes">
      {/* WhatsApp */}
      <section className="bg-white rounded-lg shadow-sm border p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">WhatsApp</h2>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-sm">
            Status: <span className={`font-medium ${waStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>{waStatus}</span>
          </div>
          {waPhone && <div className="text-sm text-gray-600">Numero: {waPhone}</div>}
          <button
            onClick={() => reconnectWhatsApp().then(loadWhatsApp)}
            className="ml-auto text-sm text-blue-600 hover:underline"
          >
            Reconectar
          </button>
        </div>
        {waQr && (
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-2">Escaneie com o WhatsApp do numero da empresa (Configuracoes → Aparelhos conectados → Conectar um aparelho)</p>
            <img src={waQr} alt="WhatsApp QR" className="inline-block rounded shadow-sm" />
          </div>
        )}
      </section>

      {/* Demais configuracoes */}
      {FIELDS.map((section) => (
        <section key={section.section} className="bg-white rounded-lg shadow-sm border p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">{section.section}</h2>
          <div className="space-y-3">
            {section.items.map((field) => (
              <div key={field.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  <input
                    type={field.isSecret && config[field.key]?.startsWith('•') ? 'text' : field.isSecret ? 'password' : 'text'}
                    value={config[field.key] || ''}
                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    placeholder={field.description}
                    className="w-full border rounded px-3 py-2 text-sm font-mono"
                  />
                  {field.description && <div className="text-xs text-gray-400 mt-1">{field.description}</div>}
                </div>
                <button
                  onClick={() => save(field)}
                  disabled={saving === field.key}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === field.key ? 'Salvando...' : savedKey === field.key ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </AdminLayout>
  );
}
