"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import {
  ApartmentOutlined,
  TeamOutlined,
  UserOutlined,
  PartitionOutlined,
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
    if (value.department === "all") {
      setScopedEmployees([]);
      return;
    }

    const loadScoped = async () => {
      setScopedLoading(true);
      try {
        const params = new URLSearchParams();
        if (value.department !== "all") {
          params.set("department", value.department);
        }
        if (value.subDepartment !== "all") {
          params.set("subDepartment", value.subDepartment);
        }
        if (value.hod !== "all") {
          params.set("hod", value.hod);
        }
        if (value.hrbp !== "all") {
          params.set("hrbp", value.hrbp);
        }
        if (value.manager !== "all") {
          params.set("manager", value.manager);
        }
        const scoped = await apiFetch<ScopedReportFilterOptions>(
          `/api/reports/filter-options/scoped?${params}`,
        );
        setScopedEmployees(scoped.employees ?? []);
      } catch {
        setScopedEmployees([]);
      } finally {
        setScopedLoading(false);
      }
    };

    void loadScoped();
  }, [value.department, value.subDepartment, value.hod, value.hrbp, value.manager]);

  const scopedOptions = useMemo(
    () => ({
      departments: options?.departments ?? [],
      subDepartments: options?.subDepartments ?? [],
      hods: options?.hods ?? [],
      hrbps: options?.hrbps ?? [],
      managers: options?.managers ?? [],
      employees: scopedEmployees,
    }),
    [options, scopedEmployees],
  );

  const cascadedOptions = useMemo(() => {
    return buildCascadedReportFilterOptions(scopedEmployees, value);
  }, [scopedEmployees, value]);

  const applyChange = (patch: Partial<ReportFilters>) => {
    let next: ReportFilters = { ...value, ...patch };

    if (patch.department !== undefined && patch.department !== value.department) {
      next = {
        ...next,
        subDepartment: "all",
        hod: "all",
        hrbp: "all",
        manager: "all",
        employee: "all",
      };
    } else if (
      patch.subDepartment !== undefined &&
      patch.subDepartment !== value.subDepartment
    ) {
      next = {
        ...next,
        hod: "all",
        hrbp: "all",
        manager: "all",
        employee: "all",
      };
    } else if (patch.hod !== undefined && patch.hod !== value.hod) {
      next = {
        ...next,
        hrbp: "all",
        manager: "all",
        employee: "all",
      };
    } else if (patch.hrbp !== undefined && patch.hrbp !== value.hrbp) {
      next = {
        ...next,
        manager: "all",
        employee: "all",
      };
    } else if (patch.manager !== undefined && patch.manager !== value.manager) {
      next = {
        ...next,
        employee: "all",
      };
    }

    onChange(
      scopedEmployees.length > 0
        ? sanitizeReportFilters(next, scopedEmployees)
        : next,
    );
  };

  const subDepartmentDisabled = value.department === "all";
  const hodDisabled = value.department === "all";
  const hrbpDisabled = value.department === "all";
  const managerDisabled = value.department === "all";
  const employeeDisabled = value.department === "all";
  const optionsLoading = loading || scopedLoading;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
      <FilterField label="Department" icon={<ApartmentOutlined />}>
        <Select
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
          options={toFieldOptions(scopedOptions.departments)}
        />
      </FilterField>

      <FilterField label="Sub Department" icon={<PartitionOutlined />}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={caseInsensitiveFilterOption}
          loading={optionsLoading}
          disabled={subDepartmentDisabled}
          value={value.subDepartment === "all" ? undefined : value.subDepartment}
          onChange={(subDepartment) =>
            applyChange({ subDepartment: subDepartment ?? "all" })
          }
          onClear={() => applyChange({ subDepartment: "all" })}
          className={selectClassName}
          placeholder="All Sub Departments"
          options={toFieldOptions(cascadedOptions.subDepartments)}
        />
      </FilterField>

      {/* <FilterField label="HOD" icon={<UserOutlined />}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={caseInsensitiveFilterOption}
          loading={optionsLoading}
          disabled={hodDisabled}
          value={value.hod === "all" ? undefined : value.hod}
          onChange={(hod) => applyChange({ hod: hod ?? "all" })}
          onClear={() => applyChange({ hod: "all" })}
          className={selectClassName}
          placeholder="All HODs"
          options={toFieldOptions(cascadedOptions.hods)}
        />
      </FilterField>

      <FilterField label="HRBP" icon={<UserOutlined />}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={caseInsensitiveFilterOption}
          loading={optionsLoading}
          disabled={hrbpDisabled}
          value={value.hrbp === "all" ? undefined : value.hrbp}
          onChange={(hrbp) => applyChange({ hrbp: hrbp ?? "all" })}
          onClear={() => applyChange({ hrbp: "all" })}
          className={selectClassName}
          placeholder="All HRBPs"
          options={toFieldOptions(cascadedOptions.hrbps)}
        />
      </FilterField> */}

      <FilterField label="Reporting Manager" icon={<TeamOutlined />}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={caseInsensitiveFilterOption}
          loading={optionsLoading}
          disabled={managerDisabled}
          value={value.manager === "all" ? undefined : value.manager}
          onChange={(manager) => applyChange({ manager: manager ?? "all" })}
          onClear={() => applyChange({ manager: "all" })}
          className={selectClassName}
          placeholder="All Reporting Managers"
          options={toFieldOptions(cascadedOptions.managers)}
        />
      </FilterField>

      {!hideEmployee && (
        <FilterField label="Employee" icon={<UserOutlined />}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={caseInsensitiveFilterOption}
          loading={optionsLoading}
          disabled={employeeDisabled}
          value={value.employee === "all" ? undefined : value.employee}
          onChange={(employee) => applyChange({ employee: employee ?? "all" })}
          onClear={() => applyChange({ employee: "all" })}
          className={selectClassName}
          placeholder="All Employees"
          options={cascadedOptions.employees.map((item) => ({
            value: item.employeeId,
            label: item.label,
          }))}
        />
      </FilterField>
      )}
    </div>
  );
}

export { DEFAULT_REPORT_FILTERS };
