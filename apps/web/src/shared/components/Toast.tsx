import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
	id: string;
	type: ToastType;
	message: string;
	title?: string;
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType, title?: string) => void;
	success: (message: string, title?: string) => void;
	error: (message: string, title?: string) => void;
	warning: (message: string, title?: string) => void;
	info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let globalToastHandler: ((message: string, type?: ToastType, title?: string) => void) | null = null;

export const toast = {
	show: (message: string, type: ToastType = "info", title?: string) => {
		globalToastHandler?.(message, type, title);
	},
	success: (message: string, title?: string) => {
		globalToastHandler?.(message, "success", title);
	},
	error: (message: string, title?: string) => {
		globalToastHandler?.(message, "error", title);
	},
	warning: (message: string, title?: string) => {
		globalToastHandler?.(message, "warning", title);
	},
	info: (message: string, title?: string) => {
		globalToastHandler?.(message, "info", title);
	},
};

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const showToast = useCallback(
		(message: string, type: ToastType = "info", title?: string) => {
			const id = Math.random().toString(36).substring(2, 9);
			const newToast: ToastItem = { id, type, message, title };

			setToasts((prev) => [...prev, newToast]);

			setTimeout(() => {
				removeToast(id);
			}, 4500);
		},
		[removeToast]
	);

	globalToastHandler = showToast;

	const contextValue: ToastContextValue = {
		showToast,
		success: (msg, t) => showToast(msg, "success", t),
		error: (msg, t) => showToast(msg, "error", t),
		warning: (msg, t) => showToast(msg, "warning", t),
		info: (msg, t) => showToast(msg, "info", t),
	};

	return (
		<ToastContext.Provider value={contextValue}>
			{children}
			<div
				aria-live="polite"
				className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0"
			>
				{toasts.map((item) => (
					<div
						key={item.id}
						data-testid={`toast-${item.type}`}
						className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-4 shadow-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
							item.type === "success"
								? "bg-emerald-900/95 text-white border-emerald-700"
								: item.type === "error"
									? "bg-red-900/95 text-white border-red-700"
									: item.type === "warning"
										? "bg-amber-900/95 text-white border-amber-700"
										: "bg-slate-900/95 text-white border-slate-700"
						}`}
					>
						{item.type === "success" && (
							<CheckCircle2 className="size-5 shrink-0 text-emerald-400 mt-0.5" />
						)}
						{item.type === "error" && <XCircle className="size-5 shrink-0 text-red-400 mt-0.5" />}
						{item.type === "warning" && (
							<AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
						)}
						{item.type === "info" && <Info className="size-5 shrink-0 text-blue-400 mt-0.5" />}

						<div className="flex-1 min-w-0">
							{item.title && <h5 className="font-extrabold text-sm mb-0.5">{item.title}</h5>}
							<p className="text-sm font-medium leading-relaxed">{item.message}</p>
						</div>

						<button
							type="button"
							onClick={() => removeToast(item.id)}
							className="text-white/70 hover:text-white rounded-lg p-1 transition-colors"
						>
							<X className="size-4" />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		return {
			showToast: toast.show,
			success: toast.success,
			error: toast.error,
			warning: toast.warning,
			info: toast.info,
		};
	}
	return context;
}
