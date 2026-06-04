"use client";

import { useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type RowClickedEvent,
  type GridReadyEvent,
} from "ag-grid-community";
import { TableSkeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { Chip } from "./chip";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

ModuleRegistry.registerModules([AllCommunityModule]);

export type ColumnType =
  | "text"
  | "avatar"
  | "badge"
  | "status-dot"
  | "currency"
  | "date"
  | "star-badge"
  | "custom";

export interface Column<T> {
  key: string;
  header: string;
  type?: ColumnType;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;

  badgeConfig?: {
    color: (row: T) => "default" | "primary" | "success" | "error" | "warning";
    label: (row: T) => string;
  };
  statusDotConfig?: {
    color: (row: T) => "success" | "warning" | "error" | "default";
    label: (row: T) => string;
  };
  avatarConfig?: {
    firstName: (row: T) => string;
    lastName?: (row: T) => string;
    subtitle?: (row: T) => string | null;
  };
  currencyConfig?: {
    value: (row: T) => number;
    colorVariant?: "default" | "success" | "error" | ((value: number) => "default" | "success" | "error");
  };
  dateConfig?: {
    value: (row: T) => string | Date | null;
    format?: "IN" | "US";
  };
  starConfig?: {
    active: (row: T) => boolean;
    label: string;
  };
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyIcon?: string;
  emptyMessage?: string;
  quickFilter?: string;
  paginationPageSize?: number;
}

const AG_GRID_THEME_OVERRIDES: React.CSSProperties = {
  "--ag-border-color": "#e2e8f0", // slate-200
  "--ag-row-border-color": "#f1f5f9", // slate-100
  "--ag-header-background-color": "#f8fafc", // slate-50
  "--ag-background-color": "#ffffff",
  "--ag-foreground-color": "#334155", // slate-700
  "--ag-header-foreground-color": "#64748b", // slate-500
  "--ag-row-hover-color": "#f8fafc", // slate-50
  "--ag-selected-row-background-color": "#e0e7ff", // indigo-100
  "--ag-font-family": "var(--font-sans)",
  "--ag-font-size": "14px",
  "--ag-border-radius": "16px",
  "--ag-header-column-separator-display": "none",
  "--ag-header-column-resize-handle-display": "none",
  "--ag-wrapper-border-radius": "16px",
  "--ag-cell-horizontal-padding": "20px",
} as React.CSSProperties;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  emptyIcon = "search_off",
  emptyMessage = "No results found",
  quickFilter,
  paginationPageSize = 20,
}: DataTableProps<T>) {
  const gridRef = useRef<AgGridReact>(null);

  const renderCell = useCallback((col: Column<T>, row: T) => {
    const colType = col.type || (col.render ? "custom" : "text");
    switch (colType) {
      case "avatar": {
        const config = col.avatarConfig;
        if (!config) return "—";
        const fName = config.firstName(row) || "";
        const lName = config.lastName ? config.lastName(row) || "" : "";
        const initials = ((fName[0] || "") + (lName ? lName[0] || "" : "")).toUpperCase().slice(0, 2) || "?";
        const subtitle = config.subtitle ? config.subtitle(row) : null;
        return (
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-label-lg font-medium shrink-0">
              {initials}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-on-surface truncate">
                {fName} {lName}
              </span>
              {subtitle && (
                <p className="text-[11px] font-medium text-on-surface-variant/80 truncate leading-none mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        );
      }
      case "badge": {
        const config = col.badgeConfig;
        if (!config) return "—";
        const color = config.color(row);
        const label = config.label(row);
        return <Chip label={label} color={color} />;
      }
      case "status-dot": {
        const config = col.statusDotConfig;
        if (!config) return "—";
        const color = config.color(row);
        const label = config.label(row);

        const dotColors: Record<string, string> = {
          success: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse",
          warning: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
          error: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
          default: "bg-slate-400",
        };

        const textColors: Record<string, string> = {
          success: "text-emerald-600 dark:text-emerald-400",
          warning: "text-amber-600 dark:text-amber-400",
          error: "text-rose-600 dark:text-rose-400",
          default: "text-slate-500 dark:text-slate-400",
        };

        return (
          <div className="flex items-center gap-2 h-full">
            <span className={cn("h-2 w-2 rounded-full shrink-0", dotColors[color] || dotColors.default)} />
            <span className={cn("text-sm font-semibold transition-colors", textColors[color] || textColors.default)}>
              {label}
            </span>
          </div>
        );
      }
      case "currency": {
        const config = col.currencyConfig;
        if (!config) return "—";
        const val = config.value(row);
        const formatted = `₹${val.toLocaleString("en-IN")}`;

        let variant = "default";
        if (typeof config.colorVariant === "function") {
          variant = config.colorVariant(val);
        } else if (config.colorVariant) {
          variant = config.colorVariant;
        }

        const colorClasses = {
          success: "text-emerald-600 font-semibold",
          error: "text-rose-600 font-semibold",
          default: "text-on-surface font-medium",
        };

        return <span className={colorClasses[variant as keyof typeof colorClasses] || colorClasses.default}>{formatted}</span>;
      }
      case "date": {
        const config = col.dateConfig;
        if (!config) return "—";
        const val = config.value(row);
        if (!val) return "—";
        const d = new Date(val);
        if (isNaN(d.getTime())) return "—";

        return (
          <span className="text-on-surface text-sm">
            {d.toLocaleDateString(config.format === "US" ? "en-US" : "en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      }
      case "star-badge": {
        const config = col.starConfig;
        if (!config || !config.active(row)) return null;
        return (
          <div className="flex items-center gap-1.5 text-primary font-semibold h-full">
            <Icon name="star" size={15} className="text-amber-500 fill-amber-500 shrink-0" />
            <span className="text-sm">{config.label}</span>
          </div>
        );
      }
      case "custom":
        return col.render ? col.render(row) : "—";
      case "text":
      default:
        return <span className="text-on-surface font-medium">{(row as any)[col.key] ?? "—"}</span>;
    }
  }, []);

  const colDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => ({
        field: col.key,
        headerName: col.header,
        cellRenderer: (params: { data: T }) => (
          <div style={{ display: "flex", alignItems: "center", height: "100%", width: "100%" }}>
            {renderCell(col, params.data)}
          </div>
        ),
        ...(col.sortValue
          ? { valueGetter: (params: { data: T }) => params.data ? col.sortValue!(params.data) : null }
          : {}),
        sortable: col.key !== "actions",
        filter: col.key !== "actions",
        suppressHeaderMenuButton: col.key === "actions",
        maxWidth: col.className?.includes("w-12") ? 64 : undefined,
        flex: col.className?.includes("w-12") ? 0 : 1,
      })),
    [columns, renderCell]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: false,
      suppressMovable: true,
    }),
    []
  );

  const getRowId = useCallback(
    (params: { data: T }) => keyExtractor(params.data),
    [keyExtractor]
  );

  const handleRowClicked = useCallback(
    (event: RowClickedEvent<T>) => {
      if (!onRowClick || !event.data) return;
      onRowClick(event.data);
    },
    [onRowClick]
  );

  const onGridReady = useCallback((_event: GridReadyEvent) => {
    // Grid is ready
  }, []);

  if (loading) {
    return <TableSkeleton rows={5} columns={columns.length || 5} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyMessage}
        description=""
      />
    );
  }

  return (
    <div
      className="ag-theme-quartz"
      style={AG_GRID_THEME_OVERRIDES}
    >
      <AgGridReact<T>
        ref={gridRef}
        rowData={data}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        onRowClicked={handleRowClicked}
        onGridReady={onGridReady}
        domLayout="autoHeight"
        pagination={true}
        paginationPageSize={paginationPageSize}
        paginationPageSizeSelector={false}
        quickFilterText={quickFilter}
        rowClass={onRowClick ? "cursor-pointer" : undefined}
        suppressCellFocus={true}
      />
    </div>
  );
}
