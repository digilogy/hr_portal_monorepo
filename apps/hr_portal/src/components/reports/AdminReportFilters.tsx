import React, { useEffect, useMemo, useState } from "react";
import { Select, Button, Tooltip } from "antd";
import {
  ApartmentOutlined,
  TeamOutlined,
  UserOutlined,
  PartitionOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { FilterClearIcon } from "@/components/ui/FilterClearIcon";
import { apiFetch } from "@/lib/api";
import { FilterField } from "@/components/ui/FilterField";
import {
  DEFAULT_REPORT_FILTERS,
  buildCascadedReportFilterOptions,
  sanitizeReportFilters,
  type ReportFilterEmployee,
  type ReportFilterOptions,
  type ReportFilters,
  type ScopedReportFilterOptions,
  caseInsensitiveFilterOption,
} from "@/lib/reportFilters";

interface AdminReportFiltersProps {
  value: ReportFilters;
  options: ReportFilterOptions | null;
  loading?: boolean;
  hideEmployee?: boolean;
  hideStatus?: boolean;
  hideClearButton?: boolean;
  onChange: (value: ReportFilters) => void;
  onClearAll?: () => void;
}

const selectClassName = "w-full";

function toFieldOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function AdminReportFilters({
  value,
  options,
  loading = false,
  hideEmployee = false,
  hideStatus = false,
  hideClearButton = false,
  onChange,
  onClearAll,
}: AdminReportFiltersProps) {
  const [scopedEmployees, setScopedEmployees] = useState<ReportFilterEmployee[]>(
    [],
  );
  const [scopedLoading, setScopedLoading] = useState(false);

  useEffect(() => {
    const loadScoped = async () => {
      setScopedLoading(true);
      try {
        const scoped = await apiFetch<ScopedReportFilterOptions>(
          "/api/reports/filter-options/scoped",
        );
        setScopedEmployees(scoped.employees ?? []);
      } catch {
        setScopedEmployees([]);
      } finally {
        setScopedLoading(false);
      }
    };

    void loadScoped();
  }, []);

  const scopedOptions = useMemo(
    () => ({
      departments: options?.departments ?? [],
      subDepartments: options?.subDepartments ?? [],
      hods: options?.hods ?? [],
      hrbps: options?.hrbps ?? [],
      managers: options?.managers ?? [],
      employees: scopedEmployees.length > 0 ? scopedEmployees : (options?.employees ?? []),
    }),
    [options, scopedEmployees],
  );

  const cascadedOptions = useMemo(() => {
    return buildCascadedReportFilterOptions(scopedEmployees, value);
  }, [scopedEmployees, value]);

  const applyChange = (patch: Partial<ReportFilters>) => {
    let next: ReportFilters = { ...value, ...patch };

    onChange(
      scopedEmployees.length > 0
        ? sanitizeReportFilters(next, scopedEmployees)
        : next,
    );
  };

  const optionsLoading = loading || scopedLoading;

  const showDept = scopedOptions.departments.length > 1;
  const showSubDept = scopedOptions.subDepartments.length > 1;
  const showManager = scopedOptions.managers.length > 1;
  const showEmployee = !hideEmployee && scopedOptions.employees.length > 1;

  const showStatus = !hideStatus;

  const isFiltered =
    (value.department && value.department !== "all") ||
    (value.subDepartment && value.subDepartment !== "all") ||
    (value.manager && value.manager !== "all") ||
    (value.employee && value.employee !== "all") ||
    (value.status && value.status !== "all");

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4 w-full">
      {showDept && (
        <FilterField label="Department" icon={<ApartmentOutlined />} className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[320px]">
          <Select
            popupMatchSelectWidth={false}
            virtual={false}
            allowClear
            showSearch
            optionFilterProp="label"
            filterOption={caseInsensitiveFilterOption}
            loading={loading}
            value={value.department === "all" ? undefined : value.department}
            onChange={(department) =>
              applyChange({ department: department ?? "all" })
            }
            onClear={() => applyChange({ department: "all" })}
            className={selectClassName}
            placeholder="All Departments"
            options={toFieldOptions(cascadedOptions.departments.length > 0 ? cascadedOptions.departments : scopedOptions.departments)}
          />
        </FilterField>
      )}

      {showSubDept && (
        <FilterField label="Sub Department" icon={<PartitionOutlined />} className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[320px]">
          <Select
            popupMatchSelectWidth={false}
            virtual={false}
            allowClear
            showSearch
            optionFilterProp="label"
            filterOption={caseInsensitiveFilterOption}
            loading={optionsLoading}
            value={value.subDepartment === "all" ? undefined : value.subDepartment}
            onChange={(subDepartment) =>
              applyChange({ subDepartment: subDepartment ?? "all" })
            }
            onClear={() => applyChange({ subDepartment: "all" })}
            className={selectClassName}
            placeholder="All Sub Departments"
            options={toFieldOptions(cascadedOptions.subDepartments.length > 0 ? cascadedOptions.subDepartments : scopedOptions.subDepartments)}
          />
        </FilterField>
      )}

      {showManager && (
        <FilterField label="Reporting Manager" icon={<TeamOutlined />} className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[320px]">
          <Select
            popupMatchSelectWidth={false}
            virtual={false}
            allowClear
            showSearch
            optionFilterProp="label"
            filterOption={caseInsensitiveFilterOption}
            loading={optionsLoading}
            value={value.manager === "all" ? undefined : value.manager}
            onChange={(manager) =>
              applyChange({ manager: manager ?? "all" })
            }
            onClear={() => applyChange({ manager: "all" })}
            className={selectClassName}
            placeholder="All Managers"
            options={toFieldOptions(cascadedOptions.managers.length > 0 ? cascadedOptions.managers : scopedOptions.managers)}
          />
        </FilterField>
      )}

      {showEmployee && (
        <FilterField label="Employee" icon={<UserOutlined />} className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[320px]">
          <Select
            popupMatchSelectWidth={true}
            virtual={false}
            allowClear
            showSearch
            optionFilterProp="label"
            filterOption={caseInsensitiveFilterOption}
            loading={optionsLoading}
            value={value.employee === "all" ? undefined : value.employee}
            onChange={(employee) => applyChange({ employee: employee ?? "all" })}
            onClear={() => applyChange({ employee: "all" })}
            className={selectClassName}
            placeholder="All Employees"
            options={(cascadedOptions.employees.length > 0 ? cascadedOptions.employees : (scopedOptions.employees || [])).map((item) => ({
              value: 'employeeId' in item ? item.employeeId : (item as any).id,
              label: 'label' in item ? item.label : `${item.name} (${item.employeeId})`,
            }))}
          />
        </FilterField>
      )}

      {showStatus && (
        <FilterField label="Status" icon={<CheckCircleOutlined />} className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[320px]">
          <Select
            allowClear
            value={value.status === "all" ? undefined : value.status}
            onChange={(status) => applyChange({ status: status ?? "all" })}
            onClear={() => applyChange({ status: "all" })}
            className={selectClassName}
            placeholder="All Statuses"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "Submitted", label: "Submitted" },
              { value: "Pending", label: "Pending" },
            ]}
          />
        </FilterField>
      )}

      {!hideClearButton && isFiltered && (
        <Tooltip title="Clear Filters">
          <Button
            size="small"
            icon={<FilterClearIcon size={26} />}
            onClick={() => {
              if (onClearAll) onClearAll();
              else onChange(DEFAULT_REPORT_FILTERS);
            }}
            className="!flex !items-center !justify-center !p-1 !bg-transparent hover:!opacity-80 !border-none shadow-none mb-1 sm:ml-auto"
            aria-label="Clear Filters"
          />
        </Tooltip>
      )}
    </div>
  );
}

export { DEFAULT_REPORT_FILTERS };
