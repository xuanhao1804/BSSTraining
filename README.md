# BSS Members CRUD App

Bài tập Technical training 1: Ứng dụng quản lý thành viên BSS - CRUD operations cho members với Remix + Shopify Polaris.

## Quick Start

### 1. Clone và cài đặt

```bash
git clone <repository-url>
cd appcrud
npm install
```

### 2. Chạy server và app

Mở 2 terminal:

**Terminal 1 - API Server:**

```bash
npm run dev:api
```

**Terminal 2 - Remix App:**

```bash
npm run dev
```

Ấn **P** để mở URL, click install để bắt đầu sử dụng.

## Tính năng

- Xem danh sách members (có pagination)
- Thêm/sửa/xóa member
- Bulk actions (duplicate/delete nhiều members)
- Click vào tên để edit

## Form Validation

Các form sử dụng Shopify React Form với validation rules:

- **Name**: Tối thiểu 2 ký tự
- **Email**: Format email hợp lệ và bắt buộc
- **Age**: Từ 18-65 tuổi
- **Gender**: Bắt buộc chọn (male/female)
- **Team**: Bắt buộc chọn team

Validation chạy real-time khi user nhập, hiển thị error message ngay lập tức.

## Troubleshooting

**Navigation lỗi:** Chỉ dùng Polaris `Link` component, không dùng `<a>`

---

_HaoLX_
