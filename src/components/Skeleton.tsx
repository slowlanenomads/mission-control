import React from 'react'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  )
}

export function SkeletonStatCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-7 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function SkeletonSessionRow() {
  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900 px-5 py-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-4 h-4" />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  )
}

export function SkeletonCronRow() {
  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900 px-5 py-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  )
}

export function SkeletonActivityFeed() {
  return (
    <div className="divide-y divide-gray-800/50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-6 py-3 border-l-2 border-l-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTodoRow() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="w-8 h-8 rounded" />
    </div>
  )
}

export default Skeleton
