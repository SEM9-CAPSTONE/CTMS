import {
	AdminSettlementsPage,
	type AdminSettlementsPageProps,
} from "../../settlements/pages/AdminSettlementsPage";

export interface AdminRefundsPageProps extends AdminSettlementsPageProps {}

export function AdminRefundsPage(props: AdminRefundsPageProps) {
	return <AdminSettlementsPage {...props} initialTab="refunds" />;
}
