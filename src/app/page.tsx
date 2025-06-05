
"use client";
import * as React from 'react';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { ColumnDefinition, HierarchicalData } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Laptop } from 'lucide-react';

interface Person extends HierarchicalData<Person> {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  isActive: boolean;
  registrationDate: string; // ISO date string
  city: 'New York' | 'London' | 'Paris' | 'Tokyo' | 'Berlin';
  progress: number; // 0-100
  children?: Person[];
}

const initialSampleData: Person[] = [
  { 
    id: 1, firstName: 'John', lastName: 'Doe', age: 30, email: 'john.doe@example.com', isActive: true, registrationDate: '2023-01-15T10:00:00Z', city: 'New York', progress: 75,
    children: [
      { id: 11, firstName: 'Ivy', lastName: 'Lee', age: 31, email: 'ivy.lee@example.com', isActive: true, registrationDate: '2023-06-15T13:10:00Z', city: 'New York', progress: 55 },
      { 
        id: 12, firstName: 'Jack', lastName: 'Harris', age: 27, email: 'jack.harris@example.com', isActive: true, registrationDate: '2022-08-05T22:00:00Z', city: 'London', progress: 65,
        children: [
           { id: 121, firstName: 'Sub Jack', lastName: 'Harris Jr.', age: 5, email: 'sub.jack@example.com', isActive: true, registrationDate: '2024-01-01T10:00:00Z', city: 'London', progress: 10 },
        ]
      },
    ]
  },
  { id: 2, firstName: 'Jane', lastName: 'Smith', age: 25, email: 'jane.smith@example.com', isActive: false, registrationDate: '2022-11-20T14:30:00Z', city: 'London', progress: 50 },
  { id: 3, firstName: 'Alice', lastName: 'Johnson', age: 35, email: 'alice.johnson@example.com', isActive: true, registrationDate: '2023-03-10T08:00:00Z', city: 'Paris', progress: 90 },
  { 
    id: 4, firstName: 'Bob', lastName: 'Brown', age: 42, email: 'bob.brown@example.com', isActive: false, registrationDate: '2021-07-01T12:15:00Z', city: 'Tokyo', progress: 30,
    children: [
      { id: 41, firstName: 'Bobby', lastName: 'Brown Jr.', age: 10, email: 'bobby.jr@example.com', isActive: true, registrationDate: '2023-08-10T10:00:00Z', city: 'Tokyo', progress: 25 }
    ]
  },
  { id: 5, firstName: 'Charlie', lastName: 'Davis', age: 28, email: 'charlie.davis@example.com', isActive: true, registrationDate: '2023-05-05T18:45:00Z', city: 'Berlin', progress: 60 },
  { id: 6, firstName: 'Diana', lastName: 'Miller', age: 32, email: 'diana.miller@example.com', isActive: true, registrationDate: '2022-09-12T09:20:00Z', city: 'New York', progress: 80 },
  { id: 7, firstName: 'Edward', lastName: 'Wilson', age: 29, email: 'edward.wilson@example.com', isActive: false, registrationDate: '2023-02-28T16:00:00Z', city: 'London', progress: 45 },
  { id: 8, firstName: 'Fiona', lastName: 'Garcia', age: 38, email: 'fiona.garcia@example.com', isActive: true, registrationDate: '2021-12-10T11:30:00Z', city: 'Paris', progress: 95 },
  { id: 9, firstName: 'George', lastName: 'Rodriguez', age: 45, email: 'george.rodriguez@example.com', isActive: true, registrationDate: '2023-04-01T07:00:00Z', city: 'Tokyo', progress: 20 },
  { id: 10, firstName: 'Helen', lastName: 'Martinez', age: 22, email: 'helen.martinez@example.com', isActive: false, registrationDate: '2022-10-18T20:00:00Z', city: 'Berlin', progress: 70 },
];

const columnDefs: ColumnDefinition<Person>[] = [
  {
    field: 'firstName',
    headerText: 'Name', // Changed from 'First Name'
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    defaultWidth: '250px', // Increased width to accommodate avatar, name, email
    iconName: 'Users',
    pinned: 'left',
    groupable: true,
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
    groupable: true,
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
    groupable: true,
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
    groupable: false, 
  },
  {
    field: 'isActive',
    headerText: 'Active',
    sortable: true,
    filterable: true,
    filterType: 'boolean',
    defaultWidth: '120px',
    iconName: 'Activity',
    groupable: true,
  },
  {
    field: 'registrationDate',
    headerText: 'Registered On',
    sortable: true,
    filterable: true,
    filterType: 'date',
    defaultWidth: '180px',
    iconName: 'CalendarDays',
    groupable: true,
  },
  {
    field: 'city',
    headerText: 'City',
    sortable: true,
    filterable: true,
    filterType: 'select',
    defaultWidth: '150px',
    iconName: 'Edit3', 
    pinned: 'right',
    groupable: true,
  },
  {
    field: 'progress',
    headerText: 'Progress',
    sortable: true,
    defaultWidth: '150px',
    iconName: 'Hash',
    editable: true,
    groupable: true,
  },
];


export default function Home() {
  const [gridData, setGridData] = React.useState<Person[]>(initialSampleData);

  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    return 'system';
  });

  React.useEffect(() => {
    const root = window.document.documentElement;
    
    const applyActualTheme = (actualTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(actualTheme);
    };

    if (theme === 'system') {
      localStorage.removeItem('theme');
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyActualTheme(systemIsDark ? 'dark' : 'light');

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (!localStorage.getItem('theme')) { 
          applyActualTheme(mediaQuery.matches ? 'dark' : 'light');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyActualTheme(theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);


  const handleCellEdit = (rowId: string | number, field: keyof Person, value: any) => {
    const updateRecursively = (items: Person[]): Person[] => {
      return items.map(item => {
        if (item.id === rowId) {
          return { ...item, [field]: value };
        }
        if (item.children) {
          return { ...item, children: updateRecursively(item.children) };
        }
        return item;
      });
    };
    setGridData(prevData => updateRecursively(prevData));
  };

  return (
    <main className="container mx-auto py-10 px-4">
      <header className="mb-8">
        <div className="flex justify-between items-start sm:items-center">
          <div>
            <h1 className="font-headline text-4xl font-bold text-primary mb-2">
              ngx-mat-data-grid
            </h1>
            <p className="text-lg text-muted-foreground">
              A feature-rich data grid component for Next.js applications, inspired by Angular Material Data Grids.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="ml-4 shrink-0">
                {theme === 'light' && <Sun className="h-5 w-5" />}
                {theme === 'dark' && <Moon className="h-5 w-5" />}
                {theme === 'system' && <Laptop className="h-5 w-5" />}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Laptop className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      <DataGrid<Person>
        data={gridData}
        columnDefs={columnDefs}
        defaultPageSize={10} 
        pageSizeOptions={[5, 10, 15, 25, 50]}
        enableRowSelection={true}
        onCellEdit={handleCellEdit}
        isTreeData={true} 
        treeColumn="firstName"
        enableGroupingPanel={true}
      />
    </main>
  );
}
