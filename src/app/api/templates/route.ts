import { NextRequest, NextResponse } from 'next/server';
import { getTemplatesPaginated } from '@/lib/templates';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '9');

    const { templates, totalCount, totalPages } = await getTemplatesPaginated(page, limit);

    return NextResponse.json({
      templates,
      totalCount,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}