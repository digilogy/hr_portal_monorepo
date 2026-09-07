"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Table, Button, Modal, Form, Input, DatePicker, Select, Switch, Space, message, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;

// Define available zones based on the provided list
const ZONES = [
  "Tamil Nadu Zone",
  "Maharashtra Zone",
  "Telangana Zone",
  "Delhi Zone",
  "Karnataka Zone",
  "Dubai Zone"
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5111";

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  zones: string[];
  isOptional: boolean;
}

export default function HolidaysAdminPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>("Tamil Nadu Zone");
  const [currentPage, setCurrentPage] = useState(1);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedZone]);

  const getAuthHeaders = useCallback(() => {
    // Attempt to get token from localStorage if auth is implemented this way
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/holidays`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch holidays");
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      console.error(error);
      messageApi.error("Could not load holidays.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, messageApi]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleAdd = () => {
    setEditingHoliday(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: Holiday) => {
    setEditingHoliday(record);
    form.setFieldsValue({
      name: record.name,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
      zones: record.zones,
      isOptional: record.isOptional
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/holidays/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to delete holiday");
      messageApi.success("Holiday deleted successfully");
      fetchHolidays();
    } catch (error) {
      console.error(error);
      messageApi.error("Could not delete holiday.");
    }
  };

  const handleModalOk = () => {
    form.submit();
  };

  const handleFormFinish = async (values: any) => {
    const payload = {
      name: values.name,
      startDate: values.dateRange[0].format("YYYY-MM-DD"),
      endDate: values.dateRange[1].format("YYYY-MM-DD"),
      zones: values.zones,
      isOptional: values.isOptional || false,
    };

    try {
      let response;
      if (editingHoliday) {
        response = await fetch(`${API_URL}/api/admin/holidays/${editingHoliday.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_URL}/api/admin/holidays`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        messageApi.error(errorData.message || "Failed to save holiday");
        return;
      }
      
      messageApi.success(`Holiday ${editingHoliday ? "updated" : "added"} successfully`);
      setIsModalVisible(false);
      fetchHolidays();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to save holiday";
      messageApi.error(errMsg);
    }
  };

  const renderDates = (start: string, end: string) => {
    const dStart = dayjs(start);
    const dEnd = dayjs(end);
    if (dStart.isSame(dEnd, 'day')) {
      return dStart.format("MMM D, dddd");
    }
    const dates = [];
    let current = dStart;
    while (current.isBefore(dEnd) || current.isSame(dEnd, 'day')) {
      dates.push(current.format("MMM D, dddd"));
      current = current.add(1, 'day');
    }
    return dates.join(", ");
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: `Date (${dayjs().format('YYYY')})`,
      key: "date",
      render: (_: any, record: Holiday) => renderDates(record.startDate, record.endDate)
    },
    {
      title: "Optional",
      dataIndex: "isOptional",
      key: "isOptional",
      render: (isOptional: boolean) => isOptional ? "Yes" : "No"
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: Holiday) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const filteredHolidays = useMemo(() => {
    if (!selectedZone) return holidays;
    return holidays.filter(h => h.zones.includes(selectedZone));
  }, [holidays, selectedZone]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {contextHolder}
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="!mb-0">Holidays</Title>
        <div className="flex items-center gap-4">
          <Select
            value={selectedZone}
            onChange={setSelectedZone}
            style={{ width: 200 }}
            options={ZONES.map(zone => ({ label: zone, value: zone }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add Holiday
          </Button>
        </div>
      </div>

      <Table 
        columns={columns} 
        dataSource={filteredHolidays} 
        rowKey="id" 
        loading={loading}
        bordered
        size="middle"
        pagination={{
          current: currentPage,
          onChange: (page) => setCurrentPage(page)
        }}
      />

      <Modal
        title={editingHoliday ? "Edit Holiday" : "Add Holiday"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        destroyOnHidden
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormFinish}
        >
          <Form.Item
            name="name"
            label="Holiday Name"
            rules={[{ required: true, message: "Please enter holiday name" }]}
          >
            <Input placeholder="e.g., Deepavali" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Date Range"
            rules={[{ required: true, message: "Please select date range" }]}
          >
            <RangePicker className="w-full" />
          </Form.Item>

          <Form.Item
            name="zones"
            label="Zones"
            rules={[{ required: true, message: "Please select at least one zone" }]}
          >
            <Select
              mode="multiple"
              placeholder="Select zones"
              options={ZONES.map(zone => ({ label: zone, value: zone }))}
            />
          </Form.Item>

          <Form.Item
            name="isOptional"
            label="Is Optional?"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
