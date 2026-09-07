"use client";

import React, { useState, useEffect } from "react";
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
  const [form] = Form.useForm();

  useEffect(() => {
    fetchHolidays();
  }, []);

  const getAuthHeaders = () => {
    // Attempt to get token from localStorage if auth is implemented this way
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/holidays`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch holidays");
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      console.error(error);
      message.error("Could not load holidays.");
    } finally {
      setLoading(false);
    }
  };

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
      const response = await fetch(`${API_URL}/api/holidays/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to delete holiday");
      message.success("Holiday deleted successfully");
      fetchHolidays();
    } catch (error) {
      console.error(error);
      message.error("Could not delete holiday.");
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
        response = await fetch(`${API_URL}/api/holidays/${editingHoliday.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_URL}/api/holidays`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) throw new Error("Failed to save holiday");
      
      message.success(`Holiday ${editingHoliday ? "updated" : "added"} successfully`);
      setIsModalVisible(false);
      fetchHolidays();
    } catch (error) {
      console.error(error);
      message.error("Failed to save holiday");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (text: string) => dayjs(text).format("MMM D, YYYY")
    },
    {
      title: "End Date",
      dataIndex: "endDate",
      key: "endDate",
      render: (text: string) => dayjs(text).format("MMM D, YYYY")
    },
    {
      title: "Zones",
      dataIndex: "zones",
      key: "zones",
      render: (zones: string[]) => zones.join(", ")
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>Holidays Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Holiday
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={holidays} 
        rowKey="id" 
        loading={loading}
        bordered
      />

      <Modal
        title={editingHoliday ? "Edit Holiday" : "Add Holiday"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        destroyOnClose
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
