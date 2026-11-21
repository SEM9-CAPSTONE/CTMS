import type React from "react";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { PerformanceReportsPage } from "./PerformanceReportsPage";

export interface AdminPerformanceReportsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export const AdminPerformanceReportsPage: React.FC<AdminPerformanceReportsPageProps> = ({
	onLogout,
}) => {
	return (
		<AdminLayout activeItem="performance-reports" onLogout={onLogout}>
			<PerformanceReportsPage />
		</AdminLayout>
	);
};
