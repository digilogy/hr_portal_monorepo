"use client";

import React from "react";
import { Select } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import { FilterField } from "@/components/ui/FilterField";
import {
  DEFAULT_DEPARTMENT_FILTER,
  type DepartmentFilter,
  type DepartmentFilterOptions,
  caseInsensitiveFilterOption,
} from "@/lib/reportFilters";

interface AdminDepartmentFilterProps {
  value: DepartmentFilter;
  options: DepartmentFilterOptions | null;
  loading?: boolean;
  onChange: (value: DepartmentFilter) => void;
  showLabel?: boolean;
  className?: string;
}

export function AdminDepartmentFilter({
  value,
  options,
  loading = false,
  onChange,
  showLabel = false,
  className = "w-full sm:w-64",
}: AdminDepartmentFilterProps) {
  const select = (
    <Select
      popupMatchSelectWidth={false}
      virtual={false}
      allowClear
      showSearch
      optionFilterProp="label"
      filterOption={caseInsensitiveFilterOption}
      loading={loading}
      value={value.department === "all" ? undefined : value.department}
      onChange={(department) => onChange({ department: department ?? "all" })}
      onClear={() => onChange({ department: "all" })}
      className={className}
      placeholder="All Departments"
      options={(options?.departments ?? []).map((department) => ({
        value: department,
        label: department,
      }))}
    />
  );

  if (!showLabel) {
    return select;
  }

  return (
    <FilterField label="Department" icon={<ApartmentOutlined />} className={className}>
      {select}
    </FilterField>
  );
}

export { DEFAULT_DEPARTMENT_FILTER };
