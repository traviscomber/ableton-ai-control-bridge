import { Sidebar } from "@/components/layout/Sidebar";

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">{children}</div>
    </div>
  );
}
