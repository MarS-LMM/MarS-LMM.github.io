import streamlit as st


def app():
    st.checkbox("Checkbox")

    st.radio("Radio", ["A", "B", "C"], horizontal=True)


if __name__ == "__main__":
    app()
