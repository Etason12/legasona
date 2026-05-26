import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Trash2, Edit } from 'lucide-react';

const Parts = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/parts')
      .then((res) => {
        setParts(res.data.parts || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load parts');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4 text-center">Loading parts...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4 overflow-x-auto">
      <h2 className="text-2xl font-semibold mb-4">Parts Inventory</h2>
      <table className="min-w-full bg-white dark:bg-slate-800 rounded-lg shadow">
        <thead className="bg-gray-100 dark:bg-slate-700">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Branch</th>
            <th className="px-4 py-2 text-left font-medium">ID</th>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Part #</th>
            <th className="px-4 py-2 text-left font-medium">Qty</th>
            <th className="px-4 py-2 text-left font-medium">Unit Price</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id} className="border-b border-gray-200 dark:border-slate-600">
              <td className="px-4 py-2">{p.branch_id}</td>
              <td className="px-4 py-2">{p.id}</td>
              <td className="px-4 py-2">{p.name}</td>
              <td className="px-4 py-2">{p.part_number}</td>
              <td className="px-4 py-2">{p.quantity}</td>
              <td className="px-4 py-2">${p.unit_price.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Parts;
