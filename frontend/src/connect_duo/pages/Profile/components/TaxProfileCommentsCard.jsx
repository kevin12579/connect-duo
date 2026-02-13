// components/TaxProfileCommentsCard.jsx
import React, { useMemo, useState } from 'react';
import CommentCard from './CommentCard';
import TaxCommentList from './TaxCommentList';

const sortDesc = (arr) => [...arr].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export default function TaxProfileCommentsCard({ comments = [] }) {
    const [open, setOpen] = useState(false);

    const sorted = useMemo(() => sortDesc(comments), [comments]);
    const latestComment = sorted[0] || null;

    return (
        <CommentCard open={open} onToggle={() => setOpen((v) => !v)} latestComment={latestComment}>
            <TaxCommentList comments={sorted} pageSize={3} />
        </CommentCard>
    );
}
