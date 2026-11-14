import type { ReactNode } from "react";
import type { SidebarControls } from "../../../shared/components/SidebarFrame";
import { SidebarLayout } from "../../../shared/components/SidebarLayout";
import { HostSosRealtimeProvider } from "../../sos-handling/components/HostSosRealtimeProvider";
import { roleLabels } from "../constants";
import { Sidebar, type SidebarProps } from "./Sidebar";

interface OperationalSidebarLayoutProps
	extends Omit<SidebarProps, keyof SidebarControls | "activeRole"> {
	activeRole: "host" | "porter";
	allowMobile: boolean;
	fixedViewport?: boolean;
	children: ReactNode;
}

export function OperationalSidebarLayout({
	activeRole,
	allowMobile,
	fixedViewport,
	children,
	...sidebarProps
}: OperationalSidebarLayoutProps) {
	return (
		<SidebarLayout
			key={activeRole}
			title={roleLabels[activeRole]}
			storageKey={`ctms:${activeRole}-sidebar-collapsed`}
			allowMobile={allowMobile}
			fixedViewport={fixedViewport}
			renderSidebar={(controls) => (
				<Sidebar {...sidebarProps} {...controls} activeRole={activeRole} />
			)}
		>
			<HostSosRealtimeProvider enabled={activeRole === "host"}>{children}</HostSosRealtimeProvider>
		</SidebarLayout>
	);
}
