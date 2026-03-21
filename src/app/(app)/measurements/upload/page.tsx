"use client";

import { Card, CardBody, Button } from "@heroui/react";

export default function UploadMeasurementsPage() {
  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📐 Upload Measurements</h1>
        <p className="text-default-500 text-sm mt-1">
          Take photos and upload door measurements
        </p>
      </div>

      <Card shadow="sm">
        <CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-default-600">Coming in Phase 4</p>
          <p className="text-sm text-default-400 mt-1 text-center max-w-sm">
            Photo upload with client-side compression, room labels, and door type selection will be built soon.
          </p>
          <Button color="primary" variant="flat" size="sm" className="mt-4" isDisabled>
            📤 Upload Measurements
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
