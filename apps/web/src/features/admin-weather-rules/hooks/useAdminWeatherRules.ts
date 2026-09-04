import { useCallback, useEffect, useState } from "react";
import { toast } from "../../../shared/components";
import { weatherRulesService } from "../services/weather-rules.service";
import type { CreateWeatherRiskRulePayload, WeatherRiskRuleItem } from "../types";

export function useAdminWeatherRules() {
	const [rules, setRules] = useState<WeatherRiskRuleItem[]>([]);
	const [activeRule, setActiveRule] = useState<WeatherRiskRuleItem | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [pendingActivateRule, setPendingActivateRule] = useState<WeatherRiskRuleItem | null>(null);

	const [isCreating, setIsCreating] = useState(false);
	const [isActivating, setIsActivating] = useState(false);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [rulesData, activeData] = await Promise.all([
				weatherRulesService.getAll(),
				weatherRulesService.getActive(),
			]);
			setRules(rulesData);
			setActiveRule(activeData);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Không thể tải danh sách bộ quy tắc rủi ro thời tiết."
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const createRule = async (payload: CreateWeatherRiskRulePayload) => {
		setIsCreating(true);
		try {
			const newRule = await weatherRulesService.createRule(payload);
			toast.success(
				`Đã tạo thành công bộ quy tắc rủi ro thời tiết phiên bản ${newRule.version}!`,
				"Tạo bộ quy tắc thành công"
			);
			setIsCreateModalOpen(false);
			await loadData();
			return newRule;
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Không thể tạo bộ quy tắc mới. Vui lòng kiểm tra dữ liệu.";
			toast.error(msg, "Lỗi cấu hình");
			throw err;
		} finally {
			setIsCreating(false);
		}
	};

	const activateRule = async (id: string) => {
		setIsActivating(true);
		try {
			const updatedRule = await weatherRulesService.activateRule(id);
			toast.success(
				`Đã kích hoạt áp dụng bộ quy tắc phiên bản ${updatedRule.version}!`,
				"Kích hoạt thành công"
			);
			setPendingActivateRule(null);
			await loadData();
			return updatedRule;
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Không thể kích hoạt bộ quy tắc. Vui lòng thử lại.";
			toast.error(msg, "Lỗi kích hoạt");
			throw err;
		} finally {
			setIsActivating(false);
		}
	};

	return {
		rules,
		activeRule,
		isLoading,
		error,
		isCreateModalOpen,
		setIsCreateModalOpen,
		pendingActivateRule,
		setPendingActivateRule,
		isCreating,
		isActivating,
		createRule,
		activateRule,
		reload: loadData,
	};
}
