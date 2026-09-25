// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

afterEach(() => cleanup());

describe('App', () => {
  it('默认示例可规划出换乘行程并高亮结果', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '规划行程' }));
    const result = screen.getByRole('status');
    expect(result.textContent).toContain('L1-01');
    expect(result.textContent).toContain('L2-01');
    expect(within(result).getByText(/换乘次数/).textContent).toContain('1');
  });

  it('修改条件后清空过期结果', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '规划行程' }));
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('起点'), { target: { value: 'B' } });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '规划行程' }));
    expect(screen.getByRole('status').textContent).toContain('无可行班次');
  });

  it('起终点相同展示零乘车行程', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('终点'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: '规划行程' }));
    expect(screen.getByRole('status').textContent).toContain('零乘车行程');
  });

  it('导入非法JSON时报错且保留示例路网', async () => {
    render(<App />);
    const fileInput = document.querySelector('.file-label input') as HTMLInputElement;
    const file = new File(['{bad'], 'bad.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('JSON解析失败');
    expect(screen.getByText(/当前：内置示例路网/)).toBeTruthy();
  });
});
