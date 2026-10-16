"use client";

import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Radio, Result, Spin, Switch, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiFetch } from "@/lib/api";
import { getTokenEmail, isSuperAdmin } from "@/lib/auth";
import type { ManagedSystemNotice, SystemNoticeType } from "@/lib/systemNotice";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MAX_MESSAGE_LENGTH = 1000;

interface NoticeFormValues {
  message: string;
  type: SystemNoticeType;
  isActive: boolean;
}

export default function MaintenancePage() {
  const [form] = Form.useForm<NoticeFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ManagedSystemNotice | null>(null);

  const previewMessage = Form.useWatch("message", form);
  const previewType = Form.useWatch("type", form);
  const previewActive = Form.useWatch("isActive", form);

  useEffect(() => {
    const ok = isSuperAdmin(getTokenEmail());
    setAllowed(ok);
    if (!ok) return;

    apiFetch<ManagedSystemNotice>("/api/system/notice/manage")
      .then((data) => {
        setSaved(data);
        form.setFieldsValue({ message: data.message, type: data.type, isActive: data.isActive });
      })
      .catch((error: Error) => messageApi.error(error.message || "Could not load the notice"))
      .finally(() => setLoading(false));
  }, [form, messageApi]);

  const save = async (values: NoticeFormValues) => {
    setSaving(true);
    try {
      const data = await apiFetch<ManagedSystemNotice>("/api/system/notice", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setSaved(data);
      form.setFieldsValue({ message: data.message, type: data.type, isActive: data.isActive });
      messageApi.success(data.isActive ? "Maintenance screen is live for all users" : "Saved. Portal is open to users");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "Failed to save notice");
    } finally {
      setSaving(false);
    }
  };

  const turnOff = () => {
    void save({ ...form.getFieldsValue(), isActive: false });
  };

  if (allowed === null) return null;

  if (!allowed) {
    return <Result status="403" title="Superadmin only" subTitle="You don't have access to this page." />;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {contextHolder}
      <Title level={2} className="!mb-1">Server Maintenance</Title>
      <Text type="secondary">
        When on, every user sees only this message (full screen) instead of the portal, including the login page. You stay
        signed in and can turn it off here. Open sessions pick up changes within a minute.
      </Text>

      <Spin spinning={loading}>
        <Card className="!mt-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={save}
            initialValues={{ message: "", type: "warning", isActive: false }}
          >
            <Form.Item
              name="message"
              label="Message"
              dependencies={["isActive"]}
              rules={[
                {
                  validator: (_, value: string) =>
                    form.getFieldValue("isActive") && !value?.trim()
                      ? Promise.reject(new Error("Enter a message before showing the notice"))
                      : Promise.resolve(),
                },
              ]}
            >
              <TextArea
                rows={4}
                maxLength={MAX_MESSAGE_LENGTH}
                showCount
                placeholder="e.g., The portal is under maintenance from 6:00 PM to 7:00 PM today. Timesheet submission may be unavailable."
              />
            </Form.Item>

            <Form.Item name="type" label="Severity">
              <Radio.Group
                optionType="button"
                options={[
                  { label: "Info", value: "info" },
                  { label: "Warning", value: "warning" },
                  { label: "Critical", value: "error" },
                ]}
              />
            </Form.Item>

            <Form.Item name="isActive" label="Show maintenance screen to users" valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
            </Form.Item>

            {previewMessage?.trim() && (
              <Form.Item label={previewActive ? "Preview" : "Preview (hidden from users)"}>
                <Alert
                  type={previewType}
                  showIcon
                  banner
                  title={<span className="whitespace-pre-line">{previewMessage.trim()}</span>}
                />
              </Form.Item>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="primary" htmlType="submit" loading={saving}>
                Save
              </Button>
              {saved?.isActive && (
                <Button danger onClick={turnOff} disabled={saving}>
                  Turn off now
                </Button>
              )}
            </div>
          </Form>

          {saved?.updatedAt && (
            <Text type="secondary" className="!mt-4 block text-xs">
              Last updated {dayjs(saved.updatedAt).format("DD MMM YYYY, h:mm A")}
              {saved.updatedBy ? ` by ${saved.updatedBy}` : ""}
              {" · "}currently {saved.isActive ? "live" : "hidden"}
            </Text>
          )}
        </Card>
      </Spin>
    </div>
  );
}
