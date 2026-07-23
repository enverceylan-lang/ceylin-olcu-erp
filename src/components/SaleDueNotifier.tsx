"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import {
  listOpenDueNotificationsForUser,
  markSaleDueNotificationShown
} from "@/lib/saleDueNotificationDb";
import {
  reconcileSaleDueNotifications
} from "@/lib/saleDueNotificationEngine";

function getTodayText(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });
}

export function SaleDueNotifier() {
  const currentUser = useAuthStore(
    state => state.currentUser
  );

  const users = useAuthStore(
    state => state.users
  );

  const customers = useStore(
    state => state.customers
  );

  const sales = useSalesStore(
    state => state.sales
  );

  const loadSales = useSalesStore(
    state => state.loadSales
  );

  const [salesLoadedForUserId, setSalesLoadedForUserId] =
    useState<string | null>(null);

  const salesLoaded =
    Boolean(currentUser?.id) &&
    salesLoadedForUserId === currentUser?.id;

  const lastProcessedKeyRef =
    useRef<string>("");

  useEffect(() => {
    let active = true;
    const userId = currentUser?.id;

    if (!userId) {
      return;
    }

    void loadSales()
      .then(() => {
        if (active) {
          setSalesLoadedForUserId(userId);
        }
      })
      .catch(error => {
        console.error(
          "[SaleDueNotifier] Satışlar yüklenemedi.",
          error
        );
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, loadSales]);

  const reconciliationKey = useMemo(() => {
    const saleKey = sales
      .map(sale => [
        sale.id,
        sale.customerId,
        sale.updatedAt,
        sale.remainingBalance,
        sale.status,
        sale.isDeleted ? "1" : "0",
        sale.isArchived ? "1" : "0"
      ].join(":"))
      .sort()
      .join("|");

    const userKey = users
      .map(user => [
        user.id,
        user.role,
        user.isActive ? "1" : "0"
      ].join(":"))
      .sort()
      .join("|");

    const customerKey = customers
      .map(customer => [
        customer.id,
        customer.name || ""
      ].join(":"))
      .sort()
      .join("|");

    return [
      currentUser?.id || "",
      getTodayText(),
      saleKey,
      userKey,
      customerKey
    ].join("::");
  }, [
    currentUser?.id,
    sales,
    users,
    customers
  ]);

  useEffect(() => {
    let active = true;

    if (
      !salesLoaded ||
      !currentUser?.id ||
      reconciliationKey ===
        lastProcessedKeyRef.current
    ) {
      return;
    }

    lastProcessedKeyRef.current =
      reconciliationKey;

    const run = async () => {
      await reconcileSaleDueNotifications({
        sales,
        users,
        customers
      });

      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const todayText = getTodayText();

      const dueNotifications =
        await listOpenDueNotificationsForUser(
          currentUser.id,
          todayText
        );

      const notShownToday =
        dueNotifications.filter(notification =>
          notification
            .lastNotifiedOnByUser?.[
              currentUser.id
            ] !== todayText
        );

      if (
        !active ||
        notShownToday.length === 0
      ) {
        return;
      }

      if (notShownToday.length === 1) {
        const notification =
          notShownToday[0];

        new Notification(
          "CEYLİN ERP — Vade Hatırlatması",
          {
            body: [
              notification.customerName,
              notification.saleNo,
              formatCurrency(
                notification.openAmount
              )
            ].join(" • "),
            tag: notification.id
          }
        );
      } else {
        const totalOpenAmount =
          notShownToday.reduce(
            (total, notification) =>
              total +
              Number(
                notification.openAmount || 0
              ),
            0
          );

        new Notification(
          "CEYLİN ERP — Vade Hatırlatmaları",
          {
            body:
              `${notShownToday.length} açık vade • ` +
              formatCurrency(totalOpenAmount),
            tag:
              `SALE_DUE_SUMMARY:${currentUser.id}:${todayText}`
          }
        );
      }

      await Promise.all(
        notShownToday.map(notification =>
          markSaleDueNotificationShown(
            notification.id,
            currentUser.id,
            todayText
          )
        )
      );
    };

    void run().catch(error => {
      console.error(
        "[SaleDueNotifier] Vade bildirim işlemi başarısız.",
        error
      );
    });

    return () => {
      active = false;
    };
  }, [
    salesLoaded,
    reconciliationKey,
    currentUser?.id,
    sales,
    users,
    customers
  ]);

  return null;
}