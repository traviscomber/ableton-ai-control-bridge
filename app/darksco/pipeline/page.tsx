import { PipelineDiagram } from '@/components/darksco/pipeline-diagram';

export const metadata = {
  title: 'DARKSCO Pipeline - 7 Agent Quality Control System',
  description: 'Visual diagram of the complete DARKSCO pipeline with all agents, quality gates, database schema, and API endpoints.',
};

export default function PipelinePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <PipelineDiagram />
    </main>
  );
}
