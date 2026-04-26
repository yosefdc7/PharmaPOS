import { PosPrototype } from "@/components/pos-prototype";
import { PosWorkspaceErrorBoundary } from "@/components/pos-workspace-error-boundary";

export default function Home() {
  return (
    <PosWorkspaceErrorBoundary>
      <PosPrototype />
    </PosWorkspaceErrorBoundary>
  );
}
