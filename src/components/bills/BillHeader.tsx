"use client";

import { Button, Chip } from "@heroui/react";
import { ArrowLeft, FileText, RotateCcw, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

export type DocumentTheme = "primary" | "success" | "warning";

export interface BillHeaderProps {
    /** Document number (e.g. INV-2024-001, CN-001) */
    documentNumber: string;
    /** Type label shown as a bordered badge */
    documentLabel: string;
    /** Date to display */
    date: string;
    /** Status of the document */
    status: string;
    /** Color theme for the header */
    theme?: DocumentTheme;
    /** Created by name */
    createdBy?: string;
    /** Back navigation path */
    backPath: string;
    /** Additional actions (edit, finalize, cancel buttons) */
    actions?: React.ReactNode;
}

const themeConfig: Record<
    DocumentTheme,
    {
        badgeColor: "primary" | "success" | "warning";
        cardBg: string;
        iconBg: string;
        iconText: string;
        icon: React.ComponentType<{ className?: string }>;
    }
> = {
    primary: {
        badgeColor: "primary",
        cardBg: "bg-primary-50 dark:bg-primary-950/20",
        iconBg: "bg-primary/10",
        iconText: "text-primary",
        icon: FileText,
    },
    success: {
        badgeColor: "success",
        cardBg: "bg-success-50 dark:bg-success-950/20",
        iconBg: "bg-success/10",
        iconText: "text-success",
        icon: RotateCcw,
    },
    warning: {
        badgeColor: "warning",
        cardBg: "bg-warning-50 dark:bg-warning-950/20",
        iconBg: "bg-warning/10",
        iconText: "text-warning",
        icon: TrendingUp,
    },
};

const statusColorMap: Record<
    string,
    "default" | "primary" | "success" | "danger" | "warning"
> = {
    DRAFT: "default",
    FINAL: "success",
    SETTLED: "success",
    CANCELLED: "danger",
    PENDING: "warning",
    OVERDUE: "danger",
    PAID: "success",
};

export function BillHeader({
    documentNumber,
    documentLabel,
    date,
    status,
    theme = "primary",
    createdBy,
    backPath,
    actions,
}: BillHeaderProps) {
    const router = useRouter();
    const config = themeConfig[theme];
    const Icon = config.icon;

    return (
        <div className="mb-6">
            {/* Top bar with back + actions */}
            <div className="flex items-center justify-between mb-4">
                <Button
                    isIconOnly
                    variant="light"
                    aria-label="Go back"
                    onPress={() => router.push(backPath)}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                {actions && (
                    <div className="flex items-center gap-2 no-print">{actions}</div>
                )}
            </div>

            {/* Document header card */}
            <div
                className={`rounded-2xl border border-divider p-5 ${config.cardBg}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div
                            className={`hidden sm:flex h-12 w-12 items-center justify-center rounded-xl ${config.iconBg} ${config.iconText}`}
                        >
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    color={config.badgeColor}
                                    className="font-semibold uppercase tracking-wider text-[10px]"
                                >
                                    {documentLabel}
                                </Chip>
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    color={statusColorMap[status] || "default"}
                                    className="capitalize"
                                >
                                    {status.toLowerCase()}
                                </Chip>
                            </div>
                            <h1 className="mt-2 text-2xl font-bold font-mono tracking-tight">
                                {documentNumber}
                            </h1>
                            <p className="mt-1 text-sm text-default-500">
                                {date}
                                {createdBy && (
                                    <span>
                                        {" "}
                                        • by <span className="font-medium">{createdBy}</span>
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

