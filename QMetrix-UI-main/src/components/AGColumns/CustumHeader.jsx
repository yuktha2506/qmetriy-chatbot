import { useState, useEffect } from 'react';
import '../../assets/css/custumHeader.scss';
import PropTypes from "prop-types";

const CustomHeader = (props) => {
    const [ascSort, setAscSort] = useState('inactive');
    const [descSort, setDescSort] = useState('inactive');
    const [noSort, setNoSort] = useState('inactive');

    useEffect(() => {
        updateSortState();
    }, []);

    const onSortChanged = () => {
        updateSortState();
    };

    const updateSortState = () => {
        const sort = props.column.getSort();
        setAscSort(sort === 'asc' ? 'active' : 'inactive');
        setDescSort(sort === 'desc' ? 'active' : 'inactive');
        setNoSort(sort === null ? 'active' : 'inactive');
    };

    const onSortRequested = (order, event) => {
        event.stopPropagation();
        props.setSort(order);
        updateSortState();
    };

    useEffect(() => {
        props.column.addEventListener('sortChanged', onSortChanged);
        return () => props.column.removeEventListener('sortChanged', onSortChanged);
    }, []);

    return (
        <div className="customHeader">
            <span>{props.displayName}</span>
            <div className="sortIcons">
                <div
                    onClick={(event) => onSortRequested('asc', event)}
                    onTouchEnd={(event) => onSortRequested('asc', event)}
                    className={`customSortDownLabel ${ascSort}`}
                >
                    <i className="fa fa-long-arrow-alt-down"></i>
                </div>
                <div
                    onClick={(event) => onSortRequested('desc', event)}
                    onTouchEnd={(event) => onSortRequested('desc', event)}
                    className={`customSortUpLabel ${descSort}`}
                >
                    <i className="fa fa-long-arrow-alt-up"></i>
                </div>
                <div
                    onClick={(event) => onSortRequested(null, event)}
                    onTouchEnd={(event) => onSortRequested(null, event)}
                    className={`customSortRemoveLabel ${noSort}`}
                >
                    <i className="fa fa-times"></i>
                </div>
            </div>
        </div>
    );
};

CustomHeader.propTypes = {
  column: PropTypes.shape({
    getSort: PropTypes.func.isRequired,
    addEventListener: PropTypes.func.isRequired,
    removeEventListener: PropTypes.func.isRequired,
  }).isRequired,
  setSort: PropTypes.func.isRequired,
  displayName: PropTypes.string.isRequired,
};

export default CustomHeader;
