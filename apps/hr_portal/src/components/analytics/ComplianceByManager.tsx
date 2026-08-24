"use client";

import React, { useState, useMemo } from "react";
import { Segmented, Button, Modal, Input, Table, Tag } from "antd";
import { UnorderedListOutlined, SearchOutlined } from "@ant-design/icons";

export interface ManagerComplianceItem {
  managerName: string;
  department?: string;
  teamSize?: number;
  totalHours?: number;
  compliancePercentage: number;
  statusBand: "on_time" | "partial" | "lagging";
}

export interface ManagerComplianceSummary {
  totalManagers: number;
  onTimeCount: number;
  onTimePct: number;
  partialCount: number;
  partialPct: number;
  laggingCount: number;
  laggingPct: number;
}

interface ComplianceByManagerProps {
  managers?: ManagerComplianceItem[];
  summary?: ManagerComplianceSummary;
}

export function ComplianceByManager({
  managers = [],
  summary,
}: ComplianceByManagerProps) {
  const [filterMode, setFilterMode] = useState<"bands" | "attention" | "top5">(
    "bands",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const computedSummary = useMemo(() => {
    if (summary) return summary;

    const total = managers.length;
    const onTime = managers.filter((m) => m.compliancePercentage >= 90).length;
    const partial = managers.filter(
      (m) => m.compliancePercentage >= 70 && m.compliancePercentage < 90,
    ).length;
    const lagging = managers.filter((m) => m.compliancePercentage < 70).length;

    return {
      totalManagers: total,
      onTimeCount: onTime,
      onTimePct: total > 0 ? Math.round((onTime / total) * 100) : 0,
      partialCount: partial,
      partialPct: total > 0 ? Math.round((partial / total) * 100) : 0,
      laggingCount: lagging,
      laggingPct: total > 0 ? Math.round((lagging / total) * 100) : 0,
    };
  }, [summary, managers]);

  const attentionManagers = useMemo(() => {
    return managers
      .filter((m) => m.compliancePercentage < 70)
      .sort((a, b) => a.compliancePercentage - b.compliancePercentage);
  }, [managers]);

  const top5Managers = useMemo(() => {
    return managers
      .filter((m) => m.compliancePercentage >= 70)
      .sort((a, b) => b.compliancePercentage - a.compliancePercentage)
      .slice(0, 5);
  }, [managers]);

  const filteredModalData = useMemo(() => {
    if (!searchQuery.trim()) return managers;
    const query = searchQuery.toLowerCase().trim();
    return managers.filter(
      (m) =>
        m.managerName.toLowerCase().includes(query) ||
        (m.department && m.department.toLowerCase().includes(query)),
    );
  }, [managers, searchQuery]);

  const columns = [
    {
      title: "Reporting Manager",
      dataIndex: "managerName",
      key: "managerName",
      render: (text: string) => <span className="font-semibold">{text}</span>,
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (text?: string) => text || "—",
    },
    {
      title: "Team Size",
      dataIndex: "teamSize",
      key: "teamSize",
      align: "center" as const,
      render: (val?: number) => val ?? "—",
    },
    {
      title: "Compliance (%)",
      dataIndex: "compliancePercentage",
      key: "compliancePercentage",
      align: "right" as const,
      render: (val: number, record: ManagerComplianceItem) => (
        <Tag
          color={
            record.statusBand === "on_time"
              ? "green"
              : record.statusBand === "partial"
              ? "orange"
              : "red"
          }
          className="font-bold border-0"
        >
          {val.toFixed(1)}%
        </Tag>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950 p-4 sm:p-4.5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">
              Compliance by Manager
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              % of team timesheets submitted ({computedSummary.totalManagers}{" "}
              managers).
            </p>
          </div>
          <Button
            size="small"
            type="text"
            icon={<UnorderedListOutlined />}
            onClick={() => setModalOpen(true)}
            className="text-xs text-gray-600 dark:text-zinc-300 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0"
          >
            All ({computedSummary.totalManagers})
          </Button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Segmented
            size="small"
            value={filterMode}
            onChange={(val) =>
              setFilterMode(val as "bands" | "attention" | "top5")
            }
            options={[
              { label: "Attention", value: "attention" },
              { label: "Top 5", value: "top5" },
              { label: "Bands", value: "bands" },
            ]}
            className="text-[11px] font-medium"
          />
        </div>

        {/* Content Views */}
        {filterMode === "bands" && (
          <div className="space-y-3">
            {/* Band 1: On Time */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1">
                <span>≥ 90% On Time</span>
                <span className="shrink-0 font-medium text-gray-700 dark:text-zinc-300">
                  {computedSummary.onTimeCount} managers ({computedSummary.onTimePct}
                  %)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      computedSummary.onTimePct,
                      computedSummary.onTimeCount > 0 ? 3 : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Band 2: Partial */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1">
                <span>70% - 89% Partial</span>
                <span className="shrink-0 font-medium text-gray-700 dark:text-zinc-300">
                  {computedSummary.partialCount} managers ({computedSummary.partialPct}
                  %)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      computedSummary.partialPct,
                      computedSummary.partialCount > 0 ? 3 : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Band 3: Lagging */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1">
                <span>&lt; 70% Lagging</span>
                <span className="shrink-0 font-medium text-gray-700 dark:text-zinc-300">
                  {computedSummary.laggingCount} managers ({computedSummary.laggingPct}
                  %)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      computedSummary.laggingPct,
                      computedSummary.laggingCount > 0 ? 3 : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {(filterMode === "attention" || filterMode === "top5") && (
          <div>
            {filterMode === "attention" && attentionManagers.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-600 font-medium">
                ✓ All managers meet compliance threshold (≥ 70%).
              </div>
            ) : filterMode === "top5" && top5Managers.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 font-medium">
                No top performing managers (compliance ≥ 70%) for this period.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(filterMode === "attention"
                  ? attentionManagers.slice(0, 5)
                  : top5Managers
                ).map((mgr, index) => {
                  const pct = Math.min(100, Math.max(0, mgr.compliancePercentage));
                  const color =
                    mgr.statusBand === "on_time"
                      ? "#10B981"
                      : mgr.statusBand === "partial"
                      ? "#F5A623"
                      : "#EF4444";

                  return (
                    <div key={mgr.managerName || index}>
                      <div className="flex justify-between items-center text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1">
                        <span className="truncate pr-2">
                          {mgr.managerName}{" "}
                          {mgr.department && (
                            <span className="text-[11px] font-normal text-gray-400">
                              ({mgr.department})
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-bold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer / Bottom detail line */}
      <div className="border-t border-gray-100 dark:border-zinc-800/80 pt-2 mt-3">
        <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* All Managers Modal */}
      <Modal
        title={`Manager Compliance Breakdown (${computedSummary.totalManagers})`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={750}
        destroyOnHidden
      >
        <div className="py-3">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search manager or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
            allowClear
          />
          <Table
            dataSource={filteredModalData}
            columns={columns}
            rowKey="managerName"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            size="small"
          />
        </div>
      </Modal>
    </div>
  );
}
