import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Star,
    MessageSquare,
    ThumbsUp,
    ThumbsDown,
    Search,
    Table,
} from "lucide-react";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "../shared/ConfirmModal";
import StatCard from "../shared/StatCard";
import Tooltip from "../shared/Tooltip";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS, markStale } from "../../store/dataStore";

export default function Reviews() {
    const [reviews, setReviews] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });
    const [stats, setStats] = useState({
        total: 0,
        good: 0,
        low: 0,
        average: 0,
    });
    const [loading, setLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState(null);
    const [ratingFilter, setRatingFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_REVIEWS);

    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: "",
        message: "",
        onConfirm: null,
        variant: "default",
    });

    const showConfirm = (title, message, onConfirm, variant = "default") => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };

    const closeConfirm = () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
    };

    useEffect(() => {
        fetchReviews(1);
    }, [ratingFilter, refreshTrigger]);

    // Added local search handler instead of fetching on every keystroke
    const handleSearch = (e) => {
        if (e.key === "Enter") {
            fetchReviews(1);
        }
    };

    const fetchReviews = async (page = 1) => {
        setLoading(true);

        try {
            const params = new URLSearchParams();
            if (ratingFilter !== "all")
                params.append("rating_filter", ratingFilter);
            if (searchTerm) params.append("search", searchTerm);
            params.append("page", page);

            const response = await api.get(`/reviews?${params.toString()}`);

            if (
                typeof response.data === "string" &&
                response.data.includes("<!DOCTYPE html>")
            ) {
                showToast(
                    "Failed to load reviews: Server returned an invalid format",
                    "error",
                );
                setReviews([]);
                return;
            }

            const data = response.data;

            if (data.stats) {
                setStats(data.stats);
            }

            if (data && data.data) {
                const reviewsPage = data.data;
                // If standard laravel pagination object
                if (reviewsPage.data) {
                    setReviews(reviewsPage.data);
                    setPagination({
                        current_page: reviewsPage.current_page,
                        last_page: reviewsPage.last_page,
                        total: reviewsPage.total,
                    });
                } else if (Array.isArray(reviewsPage)) {
                    setReviews(reviewsPage);
                    setPagination({
                        current_page: 1,
                        last_page: 1,
                        total: reviewsPage.length,
                    });
                }
            } else {
                setReviews([]);
            }
        } catch (error) {
            console.error("Failed to fetch reviews:", error);
            showToast("Failed to load reviews", "error");
            setReviews([]);
        } finally {
            setLoading(false);
        }
    };

    const deleteReview = async (reviewId) => {
        showConfirm(
            "Delete Review",
            "Are you sure you want to delete this review? This action cannot be undone.",
            async () => {
                closeConfirm();
                try {
                    await api.delete(`/reviews/${reviewId}`);
                    showToast("Review deleted successfully");

                    // Trigger sync for Admin and Customer (storefront product ratings)
                    markStale(
                        STALE_KEYS.ADMIN_REVIEWS,
                        STALE_KEYS.CUSTOMER_SHOP,
                    );

                    setSelectedReview(null);
                } catch (error) {
                    console.error("Failed to delete review:", error);
                    showToast("Failed to delete review", "error");
                }
            },
            "destructive",
        );
    };

    const renderStars = (rating) => {
        return (
            <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                    <Star
                        key={i}
                        className={`h-4 w-4 ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        Product Review Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor and analyze customer product feedback
                    </p>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Reviews"
                    value={stats.total}
                    icon={MessageSquare}
                    accentColor="blue"
                />
                <StatCard
                    label="Average Rating"
                    value={`${stats.average} / 5`}
                    icon={Star}
                    accentColor="amber"
                />
                <StatCard
                    label="Good Reviews (4-5)"
                    value={stats.good}
                    icon={ThumbsUp}
                    accentColor="green"
                />
                <StatCard
                    label="Low Reviews (1-3)"
                    value={stats.low}
                    icon={ThumbsDown}
                    accentColor="red"
                />
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex-1 w-full max-w-md">
                            <div className="relative flex">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by product or customer... (Press Enter to search)"
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    onKeyDown={handleSearch}
                                    className="w-full pl-10 pr-4 py-2 border rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <Button
                                    onClick={() => fetchReviews(1)}
                                    className="rounded-l-none"
                                >
                                    Search
                                </Button>
                            </div>
                        </div>
                        <Select
                            value={ratingFilter}
                            onValueChange={setRatingFilter}
                        >
                            <SelectTrigger className="w-full sm:w-56">
                                <SelectValue placeholder="Filter by Ratings" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Ratings</SelectItem>
                                <SelectItem value="good">
                                    Good Reviews (4-5 Stars)
                                </SelectItem>
                                <SelectItem value="low">
                                    Low Reviews (1-3 Stars)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                {!loading && reviews.length > 0 && (pagination.last_page || 1) > 1 && (
                    <div className="p-4 border-b flex items-center justify-end gap-3">
                        <p className="mr-auto hidden text-sm text-muted-foreground md:block">
                            Showing page {pagination.current_page} of {pagination.last_page || 1} ({pagination.total} total reviews)
                        </p>
                        <Pagination className="m-0 mx-0">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (pagination.current_page > 1) fetchReviews(pagination.current_page - 1);
                                        }}
                                        aria-disabled={pagination.current_page === 1}
                                        className={pagination.current_page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink isActive>{pagination.current_page}</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (pagination.current_page < (pagination.last_page || 1)) fetchReviews(pagination.current_page + 1);
                                        }}
                                        aria-disabled={pagination.current_page === (pagination.last_page || 1)}
                                        className={pagination.current_page === (pagination.last_page || 1) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted text-muted-foreground border-b">
                            <tr>
                                <th className="p-4 font-semibold">Product</th>
                                <th className="p-4 font-semibold">Customer</th>
                                <th className="p-4 font-semibold text-center">
                                    Rating
                                </th>
                                <th className="p-4 font-semibold">Feedback</th>
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="h-48 text-center"
                                    >
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </td>
                                </tr>
                            ) : reviews.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="h-48 text-center text-muted-foreground"
                                    >
                                        <Table className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                        No reviews found
                                    </td>
                                </tr>
                            ) : (
                                reviews.map((review) => (
                                    <tr
                                        key={review.id}
                                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                                    >
                                        <td
                                            className="p-4 font-medium max-w-[200px] truncate"
                                            title={review.product?.name}
                                        >
                                            {review.product?.name ||
                                                "Unknown Product"}
                                        </td>
                                        <td className="p-4">
                                            {review.customer?.name || "Guest"}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center">
                                                {renderStars(review.rating)}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-[300px]">
                                            <p
                                                className="truncate text-muted-foreground"
                                                title={review.review_text}
                                            >
                                                {review.review_text || (
                                                    <span className="italic">
                                                        No text provided
                                                    </span>
                                                )}
                                            </p>
                                        </td>
                                        <td className="p-4 whitespace-nowrap text-muted-foreground">
                                            {new Date(
                                                review.created_at,
                                            ).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Tooltip
                                                label="View Review Details"
                                                position="top"
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setSelectedReview(
                                                            review,
                                                        )
                                                    }
                                                >
                                                    View
                                                </Button>
                                            </Tooltip>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Review Details Modal */}
            {selectedReview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg shadow-xl">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle>Review Details</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedReview(null)}
                                >
                                    ×
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-lg">
                                        {selectedReview.product?.name ||
                                            "Unknown Product"}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        By{" "}
                                        {selectedReview.customer?.name ||
                                            "Guest"}{" "}
                                        •{" "}
                                        {new Date(
                                            selectedReview.created_at,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex bg-muted p-2 rounded-md">
                                    {renderStars(selectedReview.rating)}
                                </div>
                            </div>

                            <div className="bg-muted/30 p-4 rounded-lg border min-h-[100px]">
                                {selectedReview.review_text ? (
                                    <p className="text-sm leading-relaxed">
                                        {selectedReview.review_text}
                                    </p>
                                ) : (
                                    <p className="text-sm italic text-muted-foreground">
                                        No written feedback provided.
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedReview(null)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() =>
                                        deleteReview(selectedReview.id)
                                    }
                                >
                                    Delete Review
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <ConfirmModal
                modal={confirmModal || { show: false }}
                onClose={closeConfirm}
            />
        </div>
    );
}
