export { TermsPage, type TermsPageProps } from "./pages/TermsPage";
export {
	AdminTermsManagementPage,
	type AdminTermsManagementPageProps,
} from "./pages/AdminTermsManagementPage";
export {
	TermsReconsentGate,
	TermsReconsentModal,
	type TermsReconsentModalProps,
} from "./components/TermsReconsentModal";
export { TermsToc, type TermsTocProps } from "./components/TermsToc";
export {
	TermsVersionHistoryModal,
	type TermsVersionHistoryModalProps,
} from "./components/TermsVersionHistoryModal";
export { termsService } from "./services/terms.service";
export {
	useAcceptTerms,
	useCurrentTerms,
	useMyTermsStatus,
	useTermsVersionDetail,
	useTermsVersions,
} from "./hooks/useTerms";
export {
	TERMS_OUTDATED_CODE,
	formatTermsDate,
	formatTermsVersionLabel,
	isTermsVersionOutdatedError,
} from "./constants";
export type {
	AcceptTermsPayload,
	AcceptTermsResponse,
	MyTermsStatus,
	TermsAcceptanceRecord,
	TermsAcceptanceSource,
	TermsPlatform,
	TermsSection,
	TermsSubsection,
	TermsVersionDetail,
	TermsVersionSummary,
} from "./types";
