import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, Search, RefreshCw, Download } from 'lucide-react';

export default function PaginatedTable({
  title,
  description,
  apiEndpoint,
  columns,
  searchPlaceholder = "Search...",
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  showSearch = true,
  showRefresh = true,
  showExport = false,
  onExport,
  emptyMessage = "No data available",
  className = "",
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [pagination, setPagination] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        per_page: pageSize,
        ...(search && { search: search }),
      });

      const response = await axios.get(apiEndpoint, { params });
      const result = response.data;
      
      setData(result.data || []);
      setPagination({
        currentPage: result.current_page || 1,
        totalPages: result.last_page || 1,
        total: result.total || 0,
        perPage: result.per_page || pageSize,
        from: result.from || 0,
        to: result.to || 0,
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderPaginationItems = () => {
    if (!pagination) return null;

    const items = [];
    const { currentPage, totalPages } = pagination;

    // Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious 
          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    );

    // Page numbers
    const showEllipsis = totalPages > 7;
    
    if (showEllipsis) {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => handlePageChange(i)}
                isActive={i === currentPage}
                className="cursor-pointer"
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key={last}>
            <PaginationLink
              onClick={() => handlePageChange(totalPages)}
              isActive={totalPages === currentPage}
              className="cursor-pointer"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (currentPage >= totalPages - 3) {
        items.push(
          <PaginationItem key="first">
            <PaginationLink
              onClick={() => handlePageChange(1)}
              isActive={1 === currentPage}
              className="cursor-pointer"
            >
              1
            </PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = totalPages - 4; i <= totalPages; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => handlePageChange(i)}
                isActive={i === currentPage}
                className="cursor-pointer"
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
      } else {
        items.push(
          <PaginationItem key="first">
            <PaginationLink
              onClick={() => handlePageChange(1)}
              isActive={1 === currentPage}
              className="cursor-pointer"
            >
              1
            </PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => handlePageChange(i)}
                isActive={i === currentPage}
                className="cursor-pointer"
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="last">
            <PaginationLink
              onClick={() => handlePageChange(totalPages)}
              isActive={totalPages === currentPage}
              className="cursor-pointer"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={i === currentPage}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    // Next button
    items.push(
      <PaginationItem key="next">
        <PaginationNext
          onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    );

    return items;
  };

  const renderCell = (column, item, index) => {
    const value = item[column.key];
    
    if (column.render) {
      return column.render(value, item, index);
    }
    
    if (column.badge) {
      return (
        <Badge variant={column.badge.variant || 'secondary'}>
          {value}
        </Badge>
      );
    }
    
    if (column.format) {
      return column.format(value, item);
    }
    
    return value;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showExport && onExport && (
              <Button variant="outline" onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
            {showRefresh && (
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>
        
        {showSearch && (
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(pageSize)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {columns.map((column) => (
                      <th key={column.key} className="text-left py-3 px-4 font-medium text-gray-700">
                        {column.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={item.id || index} className="border-b hover:bg-gray-50">
                      {columns.map((column) => (
                        <td key={column.key} className="py-3 px-4">
                          {renderCell(column, item, index)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {pagination && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {pagination.from} to {pagination.to} of {pagination.total} entries
                  </div>
                  
                  <Pagination>
                    <PaginationContent>
                      {renderPaginationItems()}
                    </PaginationContent>
                  </Pagination>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
