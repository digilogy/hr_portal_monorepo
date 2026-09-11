"use client";

import React, { useState, useEffect } from "react";
import { Table, Card, Segmented, Grid, Pagination, Empty } from "antd";
import type { TableProps } from "antd";
import { AppstoreOutlined, TableOutlined } from "@ant-design/icons";

const { useBreakpoint } = Grid;

export interface ResponsiveTableProps<RecordType extends object = any> extends TableProps<RecordType> {
  // Optional prop to force flatten children in card view (useful for trees)
  flattenChildrenInCardView?: boolean;
  // Optional custom render for the entire card content
  cardRender?: (record: RecordType, index: number) => React.ReactNode;
  // Optional prop to hide the internal view mode toggle
  hideToggle?: boolean;
  // Optional controlled view mode
  viewMode?: "table" | "card";
  // Optional callback for view mode changes
  onViewModeChange?: (mode: "table" | "card") => void;
}

// Helper to flatten children recursively
function flattenRecords<T extends object>(data: T[], childrenField = "children"): T[] {
  const result: T[] = [];
  const visit = (list: T[]) => {
    for (const item of list) {
      result.push(item);
      const children = (item as any)[childrenField] as T[] | undefined;
      if (children && Array.isArray(children)) {
        visit(children);
      }
    }
  };
  visit(data);
  return result;
}

export function ResponsiveTable<RecordType extends object = any>({
  flattenChildrenInCardView = true,
  hideToggle = false,
  viewMode: controlledViewMode,
  onViewModeChange,
  ...props
}: ResponsiveTableProps<RecordType>) {
  const screens = useBreakpoint();
  // We consider mobile to be screens smaller than 'md' (768px)
  const isMobile = screens.md === false;
  const [internalViewMode, setInternalViewMode] = useState<"table" | "card">("table");

  const getInitialPagination = (field: 'current' | 'pageSize', defaultValue: number) => {
    if (props.pagination && typeof props.pagination === 'object' && props.pagination[field]) {
      return props.pagination[field] as number;
    }
    return defaultValue;
  };

  const [internalCurrent, setInternalCurrent] = useState(() => getInitialPagination('current', 1));
  const [internalPageSize, setInternalPageSize] = useState(() => getInitialPagination('pageSize', 10));

  // Sync internal state if parent's pagination props change
  useEffect(() => {
    if (props.pagination && typeof props.pagination === 'object') {
      if (props.pagination.current !== undefined && props.pagination.current !== internalCurrent) {
        setInternalCurrent(props.pagination.current);
      }
      if (props.pagination.pageSize !== undefined && props.pagination.pageSize !== internalPageSize) {
        setInternalPageSize(props.pagination.pageSize);
      }
    }
  }, [props.pagination]);

  const viewMode = controlledViewMode !== undefined ? controlledViewMode : internalViewMode;
  
  const handleViewModeChange = (val: "table" | "card") => {
    setInternalViewMode(val);
    onViewModeChange?.(val);
  };

  // Force card view initially on mobile
  useEffect(() => {
    if (controlledViewMode === undefined) {
      if (isMobile) {
        setInternalViewMode("card");
      } else {
        setInternalViewMode("table");
      }
    }
  }, [isMobile, controlledViewMode]);

  const { columns: originalColumns, dataSource, pagination, rowKey, loading, cardRender, ...restProps } = props;

  // Fully controlled pagination state
  const handleTableChange = (newPagination: any, filters: any, sorter: any) => {
    if (newPagination.current) setInternalCurrent(newPagination.current);
    if (newPagination.pageSize) setInternalPageSize(newPagination.pageSize);
    if (props.onChange) {
      props.onChange(newPagination, filters, sorter, { action: "paginate", currentDataSource: [] });
    }
  };

  const controlledPagination = pagination !== false ? {
    ...(typeof pagination === 'object' ? pagination : {}),
    current: internalCurrent,
    pageSize: internalPageSize,
    onChange: (page: number, pageSize: number) => {
      setInternalCurrent(page);
      setInternalPageSize(pageSize);
      if (pagination && typeof pagination === 'object' && pagination.onChange) {
        pagination.onChange(page, pageSize);
      }
    }
  } : false;

  // Automatically inject Sl.No column if it doesn't exist
  const hasSlNo = originalColumns?.some((col: any) => col.title === "Sl.No" || col.title === "S.No");
  
  const columns = hasSlNo ? originalColumns : [
    {
      title: "Sl.No",
      key: "slNo",
      width: 70,
      render: (_: any, __: any, index: number) => {
        return (internalCurrent - 1) * internalPageSize + index + 1;
      }
    },
    ...(originalColumns || [])
  ];

  const tableProps = { 
    ...restProps, 
    dataSource, 
    pagination: controlledPagination, 
    rowKey, 
    loading, 
    columns, 
    onChange: handleTableChange,
    scroll: restProps.scroll || { x: 'max-content' }
  };

  // Render header toggle
  const renderToggle = () => {
    if (hideToggle || !isMobile) return null; // Only show toggle on mobile if not hidden
    return (
      <div className="flex justify-end mb-4">
        <Segmented
          options={[
            { value: "card", icon: <AppstoreOutlined /> },
            { value: "table", icon: <TableOutlined /> },
          ]}
          value={viewMode}
          onChange={(val) => handleViewModeChange(val as "card" | "table")}
        />
      </div>
    );
  };

  if (viewMode === "table" || !isMobile) {
    return (
      <div>
        {renderToggle()}
        <Table {...tableProps} />
      </div>
    );
  }

  // --- Card View Rendering ---
  let data = (dataSource as RecordType[]) || [];
  if (flattenChildrenInCardView) {
    data = flattenRecords(data);
  }

  // Handle pagination slicing for Card view
  if (controlledPagination && controlledPagination.pageSize) {
    const startIndex = (internalCurrent - 1) * internalPageSize;
    const endIndex = startIndex + internalPageSize;
    data = data.slice(startIndex, endIndex);
  }

  const getRowKey = (record: RecordType, index?: number) => {
    if (typeof rowKey === "function") return rowKey(record, index);
    if (typeof rowKey === "string") return (record as any)[rowKey as keyof RecordType] as string;
    return index !== undefined ? index.toString() : JSON.stringify(record);
  };

  return (
    <div>
      {renderToggle()}
      
      {loading ? (
        <Table loading={loading} dataSource={[]} columns={[]} />
      ) : data.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((record, index) => (
            <Card key={getRowKey(record, index)} className="shadow-sm border border-gray-100 dark:border-zinc-800 [&>.ant-card-body]:!p-3 sm:[&>.ant-card-body]:!p-4 md:[&>.ant-card-body]:!p-5">
              {cardRender ? (
                cardRender(record, index)
              ) : (
                <div className="flex flex-col gap-3">
                  {columns?.map((col, colIndex) => {
                    if (!col || (col as any).hidden) return null;
                    const title = col.title;
                    
                    // Hide Sl.No from card view
                    if (title === "Sl.No" || title === "S.No") return null;

                    let value: any = null;
                    
                    if (col.render) {
                      const text = (col as any).dataIndex ? (record as any)[(col as any).dataIndex] : record;
                      const rendered = col.render(text, record, index);
                      if (rendered && typeof rendered === "object" && "children" in rendered && !React.isValidElement(rendered)) {
                        value = (rendered as any).children;
                      } else {
                        value = rendered;
                      }
                    } else if ((col as any).dataIndex) {
                      value = (record as any)[(col as any).dataIndex];
                    }

                    if (value === undefined || value === null || title === undefined) {
                      return null;
                    }

                    return (
                      <div key={colIndex} className="flex justify-between items-start gap-4">
                        <span className="text-gray-500 text-xs font-medium uppercase tracking-wide shrink-0">
                          {title as React.ReactNode}
                        </span>
                        <span className="text-right text-sm text-gray-900 dark:text-zinc-100 break-words">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
          
          {pagination !== false && pagination && (
            <div className="flex justify-center mt-4">
               <Pagination {...pagination} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
