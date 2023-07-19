import React from 'react';

interface DataRow {
  id: number;
  name: string;
  age: number;
  // Add other properties for your data here
}

interface DataTableProps {
  data: DataRow[];
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Age</th>
          {/* Add more table headers for other properties */}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>{row.name}</td>
            <td>{row.age}</td>
            {/* Render other properties in each row */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;
