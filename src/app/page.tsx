
"use client";
import * as React from 'react';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { ColumnDefinition } from '@/types/data-grid';
import { Badge } from '@/components/ui/badge';

interface Person {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  isActive: boolean;
  registrationDate: string; // ISO date string
  city: 'New York' | 'London' | 'Paris' | 'Tokyo' | 'Berlin';
  progress: number; // 0-100
}

const initialSampleData: Person[] = [
  { id: 1, firstName: 'John', lastName: 'Doe', age: 30, email: 'john.doe@example.com', isActive: true, registrationDate: '2023-01-15T10:00:00Z', city: 'New York', progress: 75 },
  { id: 2, firstName: 'Jane', lastName: 'Smith', age: 25, email: 'jane.smith@example.com', isActive: false, registrationDate: '2022-11-20T14:30:00Z', city: 'London', progress: 50 },
  { id: 3, firstName: 'Alice', lastName: 'Johnson', age: 35, email: 'alice.johnson@example.com', isActive: true, registrationDate: '2023-03-10T08:00:00Z', city: 'Paris', progress: 90 },
  { id: 4, firstName: 'Bob', lastName: 'Brown', age: 42, email: 'bob.brown@example.com', isActive: false, registrationDate: '2021-07-01T12:15:00Z', city: 'Tokyo', progress: 30 },
  { id: 5, firstName: 'Charlie', lastName: 'Davis', age: 28, email: 'charlie.davis@example.com', isActive: true, registrationDate: '2023-05-05T18:45:00Z', city: 'Berlin', progress: 60 },
  { id: 6, firstName: 'Diana', lastName: 'Miller', age: 32, email: 'diana.miller@example.com', isActive: true, registrationDate: '2022-09-12T09:20:00Z', city: 'New York', progress: 80 },
  { id: 7, firstName: 'Edward', lastName: 'Wilson', age: 29, email: 'edward.wilson@example.com', isActive: false, registrationDate: '2023-02-28T16:00:00Z', city: 'London', progress: 45 },
  { id: 8, firstName: 'Fiona', lastName: 'Garcia', age: 38, email: 'fiona.garcia@example.com', isActive: true, registrationDate: '2021-12-10T11:30:00Z', city: 'Paris', progress: 95 },
  { id: 9, firstName: 'George', lastName: 'Rodriguez', age: 45, email: 'george.rodriguez@example.com', isActive: true, registrationDate: '2023-04-01T07:00:00Z', city: 'Tokyo', progress: 20 },
  { id: 10, firstName: 'Helen', lastName: 'Martinez', age: 22, email: 'helen.martinez@example.com', isActive: false, registrationDate: '2022-10-18T20:00:00Z', city: 'Berlin', progress: 70 },
  { id: 11, firstName: 'Ivy', lastName: 'Lee', age: 31, email: 'ivy.lee@example.com', isActive: true, registrationDate: '2023-06-15T13:10:00Z', city: 'New York', progress: 55 },
  { id: 12, firstName: 'Jack', lastName: 'Harris', age: 27, email: 'jack.harris@example.com', isActive: true, registrationDate: '2022-08-05T22:00:00Z', city: 'London', progress: 65 },
];

const columnDefs: ColumnDefinition<Person>[] = [
  {
    field: 'firstName',
    headerText: 'First Name',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    defaultWidth: '150px',
    iconName: 'Users',
  },
  {
    field: 'lastName',
    headerText: 'Last Name',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    defaultWidth: '150px',
    iconName: 'Users',
  },
  {
    field: 'age',
    headerText: 'Age',
    sortable: true,
    filterable: true,
    filterType: 'number',
    editable: true,
    defaultWidth: '100px',
    iconName: 'Hash',
  },
  {
    field: 'email',
    headerText: 'Email',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    defaultWidth: '250px',
    iconName: 'Mail',
  },
  {
    field: 'isActive',
    headerText: 'Active',
    sortable: true,
    filterable: true,
    filterType: 'boolean',
    defaultWidth: '120px',
    iconName: 'Activity',
  },
  {
    field: 'registrationDate',
    headerText: 'Registered On',
    sortable: true,
    filterable: true,
    filterType: 'date',
    defaultWidth: '180px',
    iconName: 'CalendarDays',
  },
  {
    field: 'city',
    headerText: 'City',
    sortable: true,
    filterable: true,
    filterType: 'select',
    defaultWidth: '150px',
    iconName: 'Edit3', 
  },
  {
    field: 'progress',
    headerText: 'Progress',
    sortable: true,
    defaultWidth: '150px',
    iconName: 'Hash',
    editable: true,
  },
];


export default function Home() {
  const [gridData, setGridData] = React.useState<Person[]>(initialSampleData);

  const handleCellEdit = (rowId: string | number, field: keyof Person, value: any) => {
    setGridData(prevData =>
      prevData.map(row =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  return (
    <main className="container mx-auto py-10 px-4">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-bold text-primary mb-2">
          ngx-mat-data-grid
        </h1>
        <p className="text-lg text-muted-foreground">
          A feature-rich data grid component for Next.js applications, inspired by Angular Material Data Grids.
        </p>
      </header>
      
      <DataGrid<Person>
        data={gridData}
        columnDefs={columnDefs}
        defaultPageSize={5}
        pageSizeOptions={[5, 10, 15]}
        enableRowSelection={true}
        onCellEdit={handleCellEdit}
      />
    </main>
  );
}
