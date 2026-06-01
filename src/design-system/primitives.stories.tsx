import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Search,
  Shield,
  WalletCards,
} from "lucide-react";
import {
  DsAlert,
  DsBadge,
  DsButton,
  DsEmptyState,
  DsField,
  DsMetricCard,
  DsPanel,
  DsTableShell,
  DsToolbar,
} from "./primitives";

const meta = {
  title: "Design System/Operational Primitives",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ControlSurface: Story = {
  render: () => (
    <main className="ds-story-canvas">
      <DsPanel
        eyebrow="4 Linhas UI"
        title="Superficie operacional"
        action={<DsButton size="sm">Sincronizar</DsButton>}
      >
        <DsToolbar>
          <DsField
            label="Busca global"
            placeholder="Buscar jogo, tecnico, jogador..."
          />
          <DsButton variant="secondary">
            <Search size={15} /> Filtrar
          </DsButton>
          <DsButton variant="ghost">Limpar</DsButton>
        </DsToolbar>

        <section className="ds-story-grid">
          <DsMetricCard
            icon={<BarChart3 size={18} />}
            label="Lider"
            value="Coventry City"
            detail="12 pts"
            tone="success"
          />
          <DsMetricCard
            icon={<WalletCards size={18} />}
            label="Caixa livre"
            value="EUR 11,1 mi"
            detail="3 movimentos hoje"
            tone="info"
          />
          <DsMetricCard
            icon={<Shield size={18} />}
            label="Fair play"
            value="1 alerta"
            detail="Precisa de revisao"
            tone="warning"
          />
        </section>

        <DsAlert title="Deadline domingo" tone="warning">
          Janela reaberta ate domingo, 07/06/2026, 23:59 BRT.
        </DsAlert>
      </DsPanel>
    </main>
  ),
};

export const States: Story = {
  render: () => (
    <main className="ds-story-canvas">
      <DsPanel eyebrow="Estados" title="Badges, alertas e vazios">
        <div className="ds-story-row">
          <DsBadge tone="neutral">Neutro</DsBadge>
          <DsBadge tone="info">Info</DsBadge>
          <DsBadge tone="success">Aplicado</DsBadge>
          <DsBadge tone="warning">Atenção</DsBadge>
          <DsBadge tone="danger">Crítico</DsBadge>
          <DsBadge tone="violet">Especial</DsBadge>
        </div>

        <div className="ds-story-row">
          <DsButton>
            Primario <ArrowRight size={15} />
          </DsButton>
          <DsButton variant="secondary">Secundario</DsButton>
          <DsButton variant="ghost">Ghost</DsButton>
          <DsButton variant="danger">Risco</DsButton>
        </div>

        <section className="ds-story-grid">
          <DsAlert title="Tudo certo" tone="success">
            Fluxo validado e pronto para a rodada.
          </DsAlert>
          <DsAlert title="Revisar" tone="danger">
            Existe uma pendencia que bloqueia a acao.
          </DsAlert>
        </section>

        <DsEmptyState
          icon={<CheckCircle2 size={20} />}
          title="Sem pendencias"
          detail="Quando houver uma decisao do tecnico, ela aparece nesta fila."
          action={
            <DsButton size="sm" variant="secondary">
              Atualizar
            </DsButton>
          }
        />
      </DsPanel>
    </main>
  ),
};

export const TablePattern: Story = {
  render: () => (
    <main className="ds-story-canvas">
      <DsPanel
        eyebrow="Tabela"
        title="Padrao para listas densas"
        action={<DsBadge tone="info">TanStack-ready</DsBadge>}
      >
        <DsTableShell>
          <table>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Clube</th>
                <th>OVR</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Virgil Ghita", "Cracovia", "72", "EUR 2,19 mi", "Scout"],
                ["Nathan Nandez", "Al-Qadsiah", "76", "EUR 5,5 mi", "Radar"],
                ["Mostafa Eskhellac", "Mouscron", "71", "EUR 3,1 mi", "Lista"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DsTableShell>

        <DsAlert title="Uso recomendado" tone="info">
          Use este shell com TanStack Table para sorting, filtros e colunas.
        </DsAlert>
      </DsPanel>
    </main>
  ),
};

export const EmptyRiskState: Story = {
  render: () => (
    <main className="ds-story-canvas">
      <DsEmptyState
        icon={<AlertTriangle size={22} />}
        title="Dados indisponiveis"
        detail="Mostre o motivo e a proxima acao, sem deixar um bloco escuro vazio."
        action={<DsButton variant="secondary">Tentar novamente</DsButton>}
      />
    </main>
  ),
};
