import type React from "react";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { RevenueAnalyticsPage } from "./RevenueAnalyticsPage";

export interface AdminRevenueAnalyticsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export const AdminRevenueAnalyticsPage: React.FC<AdminRevenueAnalyticsPageProps> = ({
	onLogout,
}) => (
	<AdminLayout activeItem="revenue-analytics" onLogout={onLogout}>
		<RevenueAnalyticsPage />
	</AdminLayout>
);
