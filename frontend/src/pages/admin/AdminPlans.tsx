import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  type Plan,
} from '../../services/adminApi';

interface FormState {
  id?: number;
  name: string;
  description: string;
  price_cents: number;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price_cents: 0,
  trial_days: 15,
  is_active: true,
  sort_order: 0,
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listPlans(true);
      setPlans(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Plan) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price_cents: p.price_cents,
      trial_days: p.trial_days,
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setEditing(true);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(EMPTY_FORM);
    setEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (form.id) {
        await updatePlan(form.id, form);
      } else {
        await createPlan(form);
      }
      cancelEdit();
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar plano');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Desativar este plano?')) return;
    await deletePlan(id);
    await load();
  }

  return (
    <AdminLayout title="Planos">
      <div className="mb-4 flex justify-end">
        {!editing && (
          <button
            onClick={startCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Novo plano
          </button>
        )}
      </div>

      {editing && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-sm border p-5 mb-6 space-y-3"
        >
          <h2 className="text-sm font-semibold">{form.id ? 'Editar plano' : 'Novo plano'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome</label>
              <input
                type="text" required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Preco (centavos)</label>
              <input
                type="number" min={0} required
                value={form.price_cents}
                onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="text-xs text-gray-400 mt-1">
                {(form.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dias de trial</label>
              <input
                type="number" min={0} required
                value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ordem</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Descricao</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Ativo
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Salvar
            </button>
            <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded text-sm border">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr className="text-left">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Preco</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>
            )}
            {!loading && plans.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum plano cadastrado.</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                </td>
                <td className="px-4 py-3">{(p.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-4 py-3">{p.trial_days} dias</td>
                <td className="px-4 py-3">
                  {p.is_active ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">Ativo</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs">Inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline text-sm">
                    Editar
                  </button>
                  {p.is_active && (
                    <button onClick={() => handleDelete(p.id)} className="text-rose-600 hover:underline text-sm">
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
