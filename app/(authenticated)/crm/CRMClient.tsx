"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Customer = {
  id: string;
  salesOrderId: string;
  name: string;
  phone: string;
  email: string;
  address: string[];
  product: string;
  stockCode: string;
  consultant: string;
  salesStatus: string;
  salesStep: string;
  customerStatuses: string[];
  salesDate: string | null;
  netDate: string | null;
  memberCode: string;
  brand: string | null;
  amount: number | null;
  isPaid: boolean | null;
  paymentMethod: string;
  isCardPayment: boolean;
  isOutrightPayment: boolean;
  rentalScheme: string;
  contractMonths: number | null;
  obligationPeriodMonths: number | null;
  installation: {
    appointmentDate: string | null;
    actionDate: string | null;
    status: string;
    remark: string;
    resultRemark: string;
    hasAppointment: boolean;
  };
  callLog: string | null;
};

type StatusOption = {
  key: string;
  label: string;
};

type CRMApiResponse = {
  success: boolean;
  customers: Customer[];
  statuses: StatusOption[];
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "NET Sales":
      return "crm-status-done";

    case "Incomplete Payment":
    case "Pending Payment":
      return "crm-status-follow";

    case "Installation Stage":
    case "Call Log Stage":
      return "crm-status-new";

    case "Pending Risk Assessment / Doc. Verification":
    case "Pending Sales Info":
    case "Pending Doc. Submission":
      return "crm-status-follow";

    default:
      return "crm-status-follow";
  }
}

export default function CRMClient() {
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);

  const [search, setSearch] = useState("");

  // Default status when CRM first opens.
  const [statusFilter, setStatusFilter] = useState("Incomplete Payment");

  // Customer details popup.
  const [selected, setSelected] = useState<Customer | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination settings.
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Retrieve all historical CRM records from Supabase.
  // This request does not trigger CUCKOO API synchronisation.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/crm/customers", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const result: CRMApiResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to retrieve customer records."
          );
        }

        setCustomers(result.customers ?? []);
        setStatuses(result.statuses ?? []);
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error("CRM loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to retrieve customer records."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => controller.abort();
  }, []);

  // Apply status passed from Sales Results.
  // If no status is provided, default to Incomplete Payment.
  useEffect(() => {
    const requestedStatus = searchParams.get("status");

    if (!requestedStatus) {
      setStatusFilter("Incomplete Payment");
      return;
    }

    const matchingStatus = statuses.find(
      (status) => status.key === requestedStatus
    );

    if (matchingStatus) {
      setStatusFilter(matchingStatus.label);
    }
  }, [searchParams, statuses]);

  // Search and status filtering.
  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return customers.filter((customer) => {
      const searchableValues = [
        customer.name,
        customer.phone,
        customer.email,
        customer.product,
        customer.salesOrderId,
        customer.stockCode,
        customer.consultant,
        customer.salesStatus,
        customer.salesStep,
        customer.memberCode,
        ...customer.customerStatuses,
        ...customer.address,
      ];

      const matchesSearch =
        !term ||
        searchableValues.some((value) =>
          String(value ?? "").toLowerCase().includes(term)
        );

      const matchesStatus =
        statusFilter === "All" ||
        customer.customerStatuses.includes(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  // Reset to page 1 when search or status changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Pagination calculations.
  const totalPages = Math.ceil(
    filteredCustomers.length / pageSize
  );

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const startRecord =
    filteredCustomers.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const endRecord = Math.min(
    currentPage * pageSize,
    filteredCustomers.length
  );

  // Close popup with Escape key.
  useEffect(() => {
    if (!selected) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected]);

  return (
    <>
      <div className="crm-container">

        {/* Page heading */}
        <div className="crm-title-row">
          <div>
            <p className="crm-eyebrow">
              ACTION FORCE HUB
            </p>

            <h1>Customer Database</h1>

            <p className="crm-muted">
              View CUCKOO customer sales records and follow-ups in one place.
            </p>
          </div>
        </div>

        {/* Customer search and status filter */}
        <section className="crm-panel">

          <div className="crm-toolbar">
            <input
              className="crm-search"
              type="search"
              placeholder="Search customer, phone, product or sales order ID..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <select
              className="crm-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter sales status"
            >
              {statuses.map((status) => (
                <option
                  key={status.key}
                  value={status.label}
                >
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div className="crm-results-count">
            {loading
              ? "Loading customer records..."
              : `Showing ${startRecord.toLocaleString("en-MY")}–${endRecord.toLocaleString("en-MY")} of ${filteredCustomers.length.toLocaleString("en-MY")} matching records`}
          </div>

          {/* Error message */}
          {error && (
            <div className="crm-notice" role="alert">
              Unable to load customer records: {error}
            </div>
          )}

          {/* Customer list */}
          <div className="crm-customer-list">
            {paginatedCustomers.map((customer) => (
              <button
                type="button"
                className="crm-customer"
                key={customer.id}
                onClick={() => setSelected(customer)}
              >
                <span className="crm-customer-avatar">
                  {customer.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>

                <span className="crm-customer-info">
                  <strong>{customer.name}</strong>

                  <span>
                    {customer.salesOrderId} · {customer.product}
                  </span>

                  <span>
                    Consultant: {customer.consultant}
                  </span>
                </span>

                <span className="crm-customer-statuses">
                  {customer.customerStatuses.length > 0 ? (
                    <>
                      {customer.customerStatuses
                        .slice(0, 2)
                        .map((status) => (
                          <span
                            key={status}
                            className={`crm-status ${getStatusClass(status)}`}
                          >
                            {status}
                          </span>
                        ))}

                      {customer.customerStatuses.length > 2 && (
                        <span className="crm-status crm-status-follow">
                          +{customer.customerStatuses.length - 2}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="crm-status crm-status-follow">
                      Other / Unclassified
                    </span>
                  )}
                </span>

                <span className="crm-chevron">
                  ›
                </span>
              </button>
            ))}

            {/* Loading state */}
            {loading && (
              <div className="crm-empty">
                Loading customer records...
              </div>
            )}

            {/* Empty state */}
            {!loading &&
              !error &&
              filteredCustomers.length === 0 && (
                <div className="crm-empty">
                  <strong>
                    {customers.length === 0
                      ? "No customer records found"
                      : "No matching customers"}
                  </strong>

                  <p>
                    {customers.length === 0
                      ? "No CUCKOO sales records are currently available for your authorised team."
                      : "Try another search or change the sales status filter."}
                  </p>
                </div>
              )}
          </div>

          {/* Pagination */}
          {!loading && filteredCustomers.length > 0 && (
            <div className="crm-pagination">
              <span className="crm-pagination-label">
                Page
              </span>

              <select
                className="crm-pagination-select"
                value={currentPage}
                onChange={(event) =>
                  setCurrentPage(Number(event.target.value))
                }
                aria-label="Select page"
              >
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>

              <span className="crm-pagination-total">
                of {totalPages.toLocaleString("en-MY")} pages
              </span>
            </div>
          )}
        </section>

        {/* Customer details popup */}
        {selected && (
          <div
            className="crm-modal-backdrop"
            onClick={() => setSelected(null)}
          >
            <section
              className="crm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crm-modal-title"
              onClick={(event) => event.stopPropagation()}
            >

              {/* Popup heading */}
              <div className="crm-detail-heading">
                <div>
                  <p className="crm-eyebrow">
                    CUSTOMER PROFILE
                  </p>

                  <h2 id="crm-modal-title">
                    {selected.name}
                  </h2>
                </div>

                <button
                  type="button"
                  className="crm-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close customer profile"
                >
                  ×
                </button>
              </div>

              {/* Customer Information */}
              <div className="crm-detail-section">
                <h3>Customer Information</h3>

                <div className="crm-profile-grid">
                  <div>
                    <span>Customer Name</span>
                    <strong>{selected.name}</strong>
                  </div>

                  <div>
                    <span>Phone Number</span>

                    {selected.phone ? (
                      <a
                        href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                      >
                        {selected.phone}
                      </a>
                    ) : (
                      <strong>Not available</strong>
                    )}
                  </div>

                  <div>
                    <span>Email Address</span>
                    <strong>
                      {selected.email || "Not available"}
                    </strong>
                  </div>

                  <div className="crm-profile-full">
                    <span>Installation Address</span>
                    <strong>
                      {selected.address.length > 0
                        ? selected.address.join(", ")
                        : "Not available"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Sales Information */}
              <div className="crm-detail-section">
                <h3>Sales Information</h3>

                <div className="crm-profile-grid">
                  <div>
                    <span>Sales Order ID</span>
                    <strong>{selected.salesOrderId}</strong>
                  </div>

                  <div>
                    <span>Product</span>
                    <strong>{selected.product}</strong>
                  </div>

                  <div>
                    <span>Product Code</span>
                    <strong>
                      {selected.stockCode || "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Sales Consultant</span>
                    <strong>{selected.consultant}</strong>
                  </div>

                  <div>
                    <span>Sales Date</span>
                    <strong>{formatDate(selected.salesDate)}</strong>
                  </div>

                  <div>
                    <span>NET Date</span>
                    <strong>{formatDate(selected.netDate)}</strong>
                  </div>

                  <div>
                    <span>Sales Status</span>
                    <strong>{selected.salesStatus}</strong>
                  </div>

                  <div>
                    <span>Sales Step</span>
                    <strong>{selected.salesStep}</strong>
                  </div>

                  <div className="crm-profile-full">
                    <span>Sales Status Categories</span>

                    <div className="crm-customer-statuses">
                      {selected.customerStatuses.length > 0
                        ? selected.customerStatuses.map((status) => (
                            <span
                              key={status}
                              className={`crm-status ${getStatusClass(status)}`}
                            >
                              {status}
                            </span>
                          ))
                        : "No matching Sales Status category"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="crm-detail-section">
                <h3>Payment Information</h3>

                <div className="crm-profile-grid">
                  <div>
                    <span>Payment Status</span>
                    <strong>
                      {selected.isPaid === true
                        ? "Paid"
                        : selected.isPaid === false
                          ? "Unpaid"
                          : "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Payment Amount</span>
                    <strong>
                      {formatAmount(selected.amount)}
                    </strong>
                  </div>

                  <div>
                    <span>Payment Method</span>
                    <strong>{selected.paymentMethod}</strong>
                  </div>

                  <div>
                    <span>Payment Type</span>
                    <strong>
                      {selected.isOutrightPayment
                        ? "Outright Payment"
                        : selected.isCardPayment
                          ? "Card Payment"
                          : "Rental / Other"}
                    </strong>
                  </div>

                  <div>
                    <span>Rental Scheme</span>
                    <strong>
                      {selected.rentalScheme || "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Contract Period</span>
                    <strong>
                      {selected.contractMonths !== null
                        ? `${selected.contractMonths} months`
                        : "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Obligation Period</span>
                    <strong>
                      {selected.obligationPeriodMonths !== null
                        ? `${selected.obligationPeriodMonths} months`
                        : "Not available"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Installation and Follow-up */}
              <div className="crm-detail-section">
                <h3>Installation & Follow-up</h3>

                <div className="crm-profile-grid">
                  <div>
                    <span>Appointment Scheduled</span>
                    <strong>
                      {selected.installation.hasAppointment
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>

                  <div>
                    <span>Appointment Date</span>
                    <strong>
                      {formatDate(
                        selected.installation.appointmentDate
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Installation Status</span>
                    <strong>
                      {selected.installation.status ||
                        "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Action Date</span>
                    <strong>
                      {formatDate(
                        selected.installation.actionDate
                      )}
                    </strong>
                  </div>

                  <div className="crm-profile-full">
                    <span>Installation Remark</span>
                    <strong>
                      {selected.installation.remark ||
                        "Not available"}
                    </strong>
                  </div>

                  <div className="crm-profile-full">
                    <span>Installation Result Remark</span>
                    <strong>
                      {selected.installation.resultRemark ||
                        "Not available"}
                    </strong>
                  </div>
                </div>
              </div>
              {/* Call Log */}
              <div className="crm-detail-section">
                <h3>Call Log</h3>

                {selected.callLog ? (
                  <div
                    className="crm-call-log"
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      background: "var(--crm-card, #f8fafc)",
                      border: "1px solid var(--crm-border, #e5e7eb)",
                      borderRadius: "10px",
                      padding: "16px",
                      fontSize: "13px",
                      lineHeight: "1.7",
                      maxHeight: "400px",
                      overflowY: "auto",
                    }}
                  >
                    {selected.callLog}
                  </div>
                ) : (
                  <p className="crm-muted">
                    No call log information available for this customer.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}