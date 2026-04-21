"use client";

import { 
  Card, 
  CardBody, 
  Chip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
} from "@heroui/react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "@/components/ui/icons";

interface TransactionsClientProps {
  initialTransactions: any[];
}

export default function TransactionsClient({ initialTransactions }: TransactionsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");

  const getVoucherColor = (type: string): "primary" | "secondary" | "success" | "warning" | "danger" | "default" => {
    switch (type) {
      case "SALES": return "primary";
      case "PURCHASE": return "secondary";
      case "PAYMENT": return "success";
      case "RECEIPT": return "success";
      case "CREDIT_NOTE": return "warning";
      case "DEBIT_NOTE": return "danger";
      default: return "default";
    }
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(date));
  };

  const voucherTypes = [
    "SALES", "PURCHASE", "PAYMENT", "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL"
  ];

  const handleTypeFilter = (vt: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (vt) {
      params.set("type", vt);
    } else {
      params.delete("type");
    }
    router.push(`/transactions?${params.toString()}`);
  };

  const exportCSV = () => {
    const headers = ["Date", "Voucher Type", "Reference", "Particulars", "Debit", "Credit"];
    const rows = initialTransactions.flatMap(tx => 
      tx.lines.map((line: any) => [
        formatDate(tx.entryDate),
        tx.voucherType,
        tx.id,
        line.partyName || line.accountName || "Unknown",
        line.debit,
        line.credit
      ])
    );
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Transaction Register
          </h1>
          <p className="text-default-500 text-sm">Review all accounting entries across the system</p>
        </div>
        
        <div className="flex gap-2">
           <Button 
             size="sm" 
             variant="flat" 
             color="secondary"
             className="font-semibold"
             onPress={exportCSV}
           >
             Export CSV
           </Button>
           <Button 
             size="sm" 
             variant="flat" 
             color="primary"
             className="font-semibold"
             as={Link}
             href="/reports"
           >
             Go to Reports
           </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-default-400 uppercase tracking-wider mr-2">Filter By:</span>
        <Button 
          size="sm" 
          variant={!type ? "solid" : "flat"}
          color={!type ? "primary" : "default"}
          onPress={() => handleTypeFilter(null)}
        >
          All
        </Button>
        {voucherTypes.map((vt) => (
          <Button
            key={vt}
            size="sm"
            variant={type === vt ? "solid" : "flat"}
            color={type === vt ? getVoucherColor(vt) : "default"}
            onPress={() => handleTypeFilter(vt)}
            className="capitalize"
          >
            {vt === "SALES" ? "BILL" : vt.replace("_", " ")}
          </Button>
        ))}
      </div>

      <Card className="border-none bg-background/60 backdrop-blur-md shadow-xl overflow-hidden">
        <CardBody className="p-0">
          <Table 
            aria-label="Transactions table"
            removeWrapper
            className="min-w-full"
          >
            <TableHeader>
              <TableColumn>DATE</TableColumn>
              <TableColumn>VOUCHER</TableColumn>
              <TableColumn>PARTICULARS</TableColumn>
              <TableColumn align="end" className="text-right">DEBIT</TableColumn>
              <TableColumn align="end" className="text-right">CREDIT</TableColumn>
            </TableHeader>
            <TableBody emptyContent={
              <EmptyState 
                icon={Activity} 
                title="No transactions found" 
                description="Your transaction records will appear here. Adjust filters if needed." 
                className="py-10 border-none shadow-none bg-transparent flex items-center justify-center mx-auto" 
              />
            }>
              {initialTransactions.flatMap((tx: any) => (
                tx.lines.map((line: any, idx: number) => (
                  <TableRow key={`${tx.id}-${idx}`} className="border-b border-divider/50 hover:bg-default-50/50 transition-colors">
                    <TableCell className="w-24 text-default-600 py-3 px-4">
                      {idx === 0 ? formatDate(tx.entryDate) : ""}
                    </TableCell>
                    <TableCell className="w-40 py-3 px-4">
                      {idx === 0 ? (
                        <div className="flex flex-col gap-1">
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={getVoucherColor(tx.voucherType)}
                            className="capitalize font-semibold text-[10px]"
                          >
                            {tx.voucherType.replace("_", " ")}
                          </Chip>
                          <span className="text-[10px] font-mono text-default-400 bg-default-100 px-1.5 py-0.5 rounded w-fit">
                            #{tx.id.substring(tx.id.length - 6).toUpperCase()}
                          </span>
                        </div>
                      ) : ""}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {line.partyName || line.accountName || "Unknown"}
                        </span>
                        {idx === 0 && tx.narration && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-default-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span className="text-[10px] text-default-400">
                               {tx.narration}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-default-700 py-3 px-4">
                      {Number(line.debit) > 0 ? (
                        <span className="text-danger font-medium">{Number(line.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      ) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-default-700 py-3 px-4">
                      {Number(line.credit) > 0 ? (
                        <span className="text-success font-medium">{Number(line.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      ) : ""}
                    </TableCell>
                  </TableRow>
                ))
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
      
      <p className="text-center text-[10px] text-default-400">
        Showing last {initialTransactions.length} entries. Use Reports for full exports.
      </p>
    </div>
  );
}
