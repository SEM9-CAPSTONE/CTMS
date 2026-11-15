import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { getGrantedRoles } from "../../auth/utils/permissions";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import type { ReportContext } from "../types";
import { ReportDialog } from "./ReportDialog";

export function ReportAction({ actor, context }: { actor: string; context: ReportContext }) {
	const [open, setOpen] = useState(false);
	const user = getStoredAuthUser();
	if (
		!user ||
		user.id !== actor ||
		!getGrantedRoles(user).includes("host") ||
		!window.location.pathname.startsWith("/host/")
	)
		return null;
	return (
		<div className="mt-3">
			<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
				Báo cáo nội dung
			</Button>
			{open && <ReportDialog actor={actor} context={context} onClose={() => setOpen(false)} />}
		</div>
	);
}
