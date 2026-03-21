"use client";

import { Card, CardBody } from "@heroui/react";

export default function MyUploadsPage() {
  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Uploads</h1>
        <p className="text-default-500 text-sm mt-1">
          Track the status of your measurement uploads
        </p>
      </div>

      <Card shadow="sm">
        <CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-default-100 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-lg font-medium text-default-600">No uploads yet</p>
          <p className="text-sm text-default-400 mt-1">
            Your measurement uploads will appear here
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
