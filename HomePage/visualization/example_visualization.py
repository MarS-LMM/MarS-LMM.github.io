from contextlib import contextmanager

import matplotlib.pyplot as plt


# Define the context manager.
@contextmanager
def plot_style(bg_color="white", text_color="black", alpha: float = 1):
    """Use this context manager to temporarily set the style of your plots."""
    with plt.rc_context(
        {
            "figure.facecolor": bg_color,  # 设置图表背景色
            "axes.facecolor": bg_color,  # 设置轴背景色
            "axes.labelcolor": text_color,  # 设置轴标签颜色
            "xtick.color": text_color,  # 设置x轴刻度颜色
            "ytick.color": text_color,  # 设置y轴刻度颜色
            "text.color": text_color,  # 设置文本颜色
            "axes.edgecolor": text_color,  # 设置轴边框颜色
            "savefig.facecolor": bg_color,  # 保存图表时的背景色
            "savefig.edgecolor": bg_color,  # 保存图表时的边框色
            "savefig.transparent": alpha < 1,  # 设置透明度
        }
    ):
        yield


import numpy as np

# Create random data for the charts
x = np.arange(10)
y1 = np.abs(np.random.randn(10).cumsum())
y2 = np.abs(np.random.randn(10).cumsum())


def example_line_plot():
    """Create a simple line plot."""
    with plot_style(bg_color="#000000", text_color="#FFFFFF", alpha=1):
        plt.figure(figsize=(8, 4))
        plt.plot(x, y1, label="Line 1", linewidth=2, marker="o", color="#A4CE95")
        plt.plot(x, y2, label="Line 2", linewidth=2, marker="s", color="#F4EDCC")
        plt.title("Classic Line Plot")
        plt.xlabel("X Axis")
        plt.ylabel("Y Axis")
        plt.legend()
        plt.savefig("classic_line_plot.png", bbox_inches="tight", dpi=300)
        plt.show()


def example_bar_plot():
    """Create a simple bar plot."""
    with plot_style(bg_color="#000000", text_color="#FFFFFF", alpha=1):
        plt.figure(figsize=(8, 4))
        width = 0.35  # the width of the bars
        plt.bar(x - width / 2, y1, width, label="Bar 1", color="#A4CE95")
        plt.bar(x + width / 2, y2, width, label="Bar 2", color="#F4EDCC")
        plt.title("Classic Bar Chart")
        plt.xlabel("X Axis")
        plt.ylabel("Y Axis")
        plt.legend()
        plt.savefig("classic_bar_plot.png", bbox_inches="tight", dpi=300)
        plt.show()


def example_combined_plot():
    """Create a combined line and bar plot."""
    with plot_style(bg_color="#000000", text_color="#FFFFFF", alpha=1):
        plt.figure(figsize=(8, 4))
        plt.bar(x, y1, width=0.4, label="Bar", color="#F99417")
        plt.plot(x, y2, label="Line", color="#F5F5F5", linewidth=2, marker="d")
        plt.title("Combined Line and Bar Chart")
        plt.xlabel("X Axis")
        plt.ylabel("Y Axis")
        plt.legend()
        plt.savefig("classic_line_bar_plot.png", bbox_inches="tight", dpi=300)
        plt.show()


def main():
    """Run the example plots."""
    example_line_plot()
    example_bar_plot()
    example_combined_plot()


if __name__ == "__main__":
    main()
