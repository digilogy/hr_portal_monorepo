"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import {
  ApartmentOutlined,
  TeamOutlined,
  UserOutlined,
  PartitionOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
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
  onChange: (value: ReportFilters) => void;
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
  onChange,
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

  const showStatus = true;

  const visibleCount = [showDept, showSubDept, showManager, showEmployee, showStatus].filter(Boolean).length;
  const wrapperClass = visibleCount <= 1
    ? "flex flex-col w-full sm:w-80 md:w-96 max-w-md gap-4"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full";

  return (
    <div className={wrapperClass}>
      {showDept && (
        <FilterField label="Department" icon={<ApartmentOutlined />}>
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
        <FilterField label="Sub Department" icon={<PartitionOutlined />}>
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
        <FilterField label="Reporting Manager" icon={<TeamOutlined />}>
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
        <FilterField label="Employee" icon={<UserOutlined />}>
          <Select
            popupMatchSelectWidth={false}
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
              value: 'employeeId' in item ? item.employeeId : (item as any).id, // Handle potential type mismatch just in case, though they should both have employeeId
              label: 'label' in item ? item.label : `${item.name} (${item.employeeId})`,
            }))}
          />
        </FilterField>
      )}

      {showStatus && (
        <FilterField label="Status" icon={<CheckCircleOutlined />}>
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
    </div>
  );
}

export { DEFAULT_REPORT_FILTERS };
